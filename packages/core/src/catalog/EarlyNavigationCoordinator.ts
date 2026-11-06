/** The visual owner retains the source until the router can commit its destination. */
export interface EarlyNavigationHandle {
	readonly finished: Promise<boolean>;
	cancel(reason?: EarlyNavigationCancelReason): void;
}

export type EarlyNavigationCancelReason =
	| 'superseded' | 'cancelled' | 'history' | 'leave' | 'interaction'
	| 'resize' | 'error' | 'redirect' | 'destroyed';

export type EarlyNavigationData =
	| { type: 'loaded'; status: number }
	| { type: 'redirect'; location: string };

export interface EarlyNavigationAdapter {
	preload(destination: string, signal: AbortSignal): Promise<EarlyNavigationData>;
	navigate(destination: string): Promise<void>;
}

const CANCELLED = Symbol('cancelled');
interface Owner {
	destination: string;
	handle: EarlyNavigationHandle;
	stopped: Promise<typeof CANCELLED>;
	stop(): void;
	visualCancelled: boolean;
	abort: AbortController;
	replay?: string;
}

/**
 * A cancelled original navigation never enters the router's commit queue. Data can
 * load while its source moves; only the current owner receives one replay permit.
 * No router internals, timers, DOM, or frame-loop work are required here.
 */
export class EarlyNavigationCoordinator {
	private current?: Owner;
	constructor(private readonly adapter: EarlyNavigationAdapter) {}

	get pending(): boolean { return this.current !== undefined; }

	/** Called synchronously by the adapter's before-navigation hook for its own goto. */
	acceptReplay(destination: string): boolean {
		const owner = this.current;
		if (!owner || owner.replay !== destination) return false;
		owner.replay = undefined;
		return true;
	}

	cancel(reason: EarlyNavigationCancelReason = 'cancelled'): void {
		const owner = this.current;
		if (!owner) return;
		this.current = undefined;
		owner.replay = undefined;
		owner.stop();
		owner.abort.abort();
		this.cancelVisual(owner, reason);
	}

	async start(destination: string, handle: EarlyNavigationHandle): Promise<void> {
		this.cancel('superseded');
		let stop!: Owner['stop'];
		const stopped = new Promise<typeof CANCELLED>(resolve => { stop = () => resolve(CANCELLED); });
		const owner: Owner = { destination, handle, stopped, stop, visualCancelled: false, abort: new AbortController() };
		this.current = owner;
		// Attach handlers immediately: a rejected visual promise must never become
		// an unhandled rejection while a slow data request is still pending.
		const motion = Promise.resolve(handle.finished).then(
			completed => {
				if (!completed && this.current === owner) this.cancel('cancelled');
				return { completed, failed: false };
			},
			() => ({ completed: false, failed: true })
		);
		try {
			const data = await Promise.race([
				Promise.resolve().then(() => this.current === owner
					? this.adapter.preload(destination, owner.abort.signal) : undefined).catch(() => undefined),
				stopped
			]);
			if (data === CANCELLED || this.current !== owner) return;
			if (!data || (data.type === 'loaded' && data.status >= 400)) {
				this.cancelVisual(owner, 'error');
				await this.commit(owner, destination);
				return;
			}
			if (data.type === 'redirect') {
				this.cancelVisual(owner, 'redirect');
				await this.commit(owner, new URL(data.location, destination).href);
				return;
			}
			const result = await Promise.race([motion, stopped]);
			if (result === CANCELLED || this.current !== owner) return;
			if (result.failed) {
				this.cancelVisual(owner, 'error');
				await this.commit(owner, destination);
			} else if (result.completed) await this.commit(owner, destination);
			else this.cancel('cancelled');
		} finally {
			if (this.current === owner) this.current = undefined;
			owner.replay = undefined;
			owner.abort.abort();
		}
	}

	private cancelVisual(owner: Owner, reason: EarlyNavigationCancelReason): void {
		if (owner.visualCancelled) return;
		owner.visualCancelled = true;
		try { owner.handle.cancel(reason); }
		catch { /* Visual cleanup must not prevent the router's ordinary error path. */ }
	}

	private async commit(owner: Owner, destination: string): Promise<void> {
		if (this.current !== owner) return;
		owner.replay = destination;
		try { await this.adapter.navigate(destination); }
		catch { this.cancelVisual(owner, 'error'); }
	}
}
