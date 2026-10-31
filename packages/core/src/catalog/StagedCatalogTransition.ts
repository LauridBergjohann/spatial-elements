import type { EarlyNavigationCancelReason, EarlyNavigationHandle } from './EarlyNavigationCoordinator.js';
import { createSourceDomMotion, type SourceDomProjection, type SourceDomTarget } from './SourceDomMotion.js';
import { ASYNC_REVEAL_DURATION, MOTION_DURATION, easeInOutSine } from './transitionTiming.js';
import type { CssProjectionQuad } from '../stage/cssProjection.js';

export interface StagedDomActor { element: HTMLElement; projection: SourceDomProjection; target: SourceDomTarget }
export interface StagedDomFrame { element: HTMLElement; quad: CssProjectionQuad; width: number; height: number }
export type StagedCatalogTransitionPhase = 'idle' | 'moving' | 'holding' | 'held' | 'revealing' | 'committing' | 'complete' | 'cancelled';
export interface StagedCatalogTransitionHooks {
	/** Only already prepared source resources may be used here. */
	begin(): boolean;
	frame(frame: { progress: number; exit: number; quads: readonly StagedDomFrame[] }): void;
	/** Runs after the last moving frame has had a paint opportunity. */
	hold(frame: { quads: readonly StagedDomFrame[]; signal: AbortSignal; releaseDomStyles(): void }): boolean | Promise<boolean>;
	reveal(progress: number): void;
	finish(): void;
	cancel(reason: EarlyNavigationCancelReason): void;
	/** Optional diagnostics; an observer failure never prevents ownership cleanup. */
	error?(error: unknown, phase: StagedCatalogTransitionPhase): void;
}
export interface StagedCatalogTransitionOptions {
	actors: readonly StagedDomActor[];
	exiting?: readonly HTMLElement[];
	reducedMotion?: boolean;
	hooks: StagedCatalogTransitionHooks;
}
interface FadedElement { element: HTMLElement; value: string; priority: string; opacity: number }
const saveFade = (element: HTMLElement): FadedElement => ({ element,
	value: element.style.getPropertyValue('opacity'), priority: element.style.getPropertyPriority('opacity'),
	opacity: Number.parseFloat(getComputedStyle(element).opacity) || 0 });
const writeFade = (entry: FadedElement, fraction: number) => entry.element.style.setProperty('opacity', String(entry.opacity * fraction), 'important');
const restoreFade = (entry: FadedElement) => entry.value
	? entry.element.style.setProperty('opacity', entry.value, entry.priority) : entry.element.style.removeProperty('opacity');

/** Owns source-only motion, the static hold, and the later content reveal. */
export class StagedCatalogTransition {
	private state: StagedCatalogTransitionPhase = 'idle';
	private frame = 0;
	private generation = 0;
	private motions: ReturnType<typeof createSourceDomMotion>[] = [];
	private quads: StagedDomFrame[] = [];
	private exits: FadedElement[] = [];
	private incoming: FadedElement[] = [];
	private interactivity: { element: HTMLElement; inert: boolean }[] = [];
	private releaseMotion?: (value: boolean) => void;
	private rejectMotion?: (reason: unknown) => void;
	private releaseReveal?: () => void;
	private domStylesReleased = false;
	private cleaned = false;
	private abort = new AbortController();
	private stopWaiting!: () => void;
	private stopped = new Promise<void>(resolve => { this.stopWaiting = resolve; });
	constructor(private readonly options: StagedCatalogTransitionOptions) {}
	get phase() { return this.state; }

	start(): EarlyNavigationHandle | undefined {
		if (this.state !== 'idle') return;
		const preparationStarted = performance.now();
		try {
			if (!this.options.hooks.begin()) { this.cancel('error'); return; }
			for (const actor of this.options.actors) {
				const motion = createSourceDomMotion(actor.element, actor.projection, actor.target);
				if (!motion) { this.cancel('error'); return; }
				this.motions.push(motion);
				this.interactivity.push({ element: actor.element, inert: actor.element.inert });
				actor.element.inert = true;
			}
			// Fading an ancestor would also flatten/hide the retained source. Those
			// branches must be split by the caller; never apply an unsafe opacity.
			this.exits = [...new Set(this.options.exiting ?? [])]
				.filter(element => !this.options.actors.some(actor => element.contains(actor.element)))
				.map(saveFade);
			const finished = new Promise<boolean>((resolve, reject) => { this.releaseMotion = resolve; this.rejectMotion = reject; });
			// A synchronous frame hook may fail before start can return its handle.
			void finished.catch(() => {});
			this.state = 'moving';
			const generation = ++this.generation;
			const prepared = performance.now();
			// Use the preparation time for the first visible movement instead of
			// waiting for another RAF. A slow preparation contributes at most one
			// nominal frame; shifting the clock retains the remaining motion.
			const started = prepared - Math.min(1000 / 60, Math.max(0, prepared - preparationStarted));
			let fraction = 0;
			const advance = (time: number, synchronous = false) => {
				if (generation !== this.generation || this.state !== 'moving') return;
				// RAF timestamps refer to the beginning of a frame and can precede
				// the synchronous first submission. Never move that submission back.
				const nextFraction = this.options.reducedMotion ? 1 : Math.min(1, Math.max(fraction, (time - started) / MOTION_DURATION));
				// A RAF from the already active browser frame can be older than the
				// synchronous submission. Keep its next tick, but do not submit the
				// identical DOM/GPU pose twice before it has reached the display.
				if (!synchronous && nextFraction === fraction) {
					this.frame = requestAnimationFrame(animate);
					return;
				}
				fraction = nextFraction;
				this.move(fraction);
				if (generation !== this.generation || this.state !== 'moving') return;
				if (fraction < 1) this.frame = requestAnimationFrame(animate);
				else {
					this.state = 'holding';
					const afterPaint = () => {
						if (generation !== this.generation || this.state !== 'holding') return;
						this.frame = requestAnimationFrame(() => { void this.hold(generation); });
					};
					// A synchronous Reduced Motion endpoint needs a RAF paint barrier
					// before the following RAF may prepare DOM/GPU ownership. An
					// endpoint drawn inside RAF already has that paint opportunity.
					if (synchronous) this.frame = requestAnimationFrame(afterPaint);
					else afterPaint();
				}
			};
			const animate = (time: number) => {
				try { advance(time); } catch (error) { this.fail(error); }
			};
			advance(prepared, true);
			return { finished, cancel: reason => this.cancel(reason) };
		} catch (error) { this.fail(error); return; }
	}

	private move(fraction: number) {
		const progress = 1 - (1 - fraction) ** 2;
		const exit = (1 - Math.min(1, fraction * MOTION_DURATION / 140)) ** 2;
		this.quads = this.options.actors.map((actor, index) => {
			const quad = this.motions[index]!.update(progress);
			if (!quad) throw new Error('Invalid source DOM projection');
			return { element: actor.element, quad, width: actor.projection.width, height: actor.projection.height };
		});
		for (const entry of this.exits) writeFade(entry, exit);
		this.options.hooks.frame({ progress, exit, quads: this.quads });
	}

	private async hold(generation: number) {
		if (generation !== this.generation || this.state !== 'holding') return;
		try {
			const held = await Promise.race([
				this.options.hooks.hold({ quads: this.quads, signal: this.abort.signal, releaseDomStyles: () => this.restoreMotionStyles() }),
				this.stopped.then(() => false)
			]);
			if (generation !== this.generation) return;
			if (!held) throw new Error('Could not retain the source presentation');
			this.state = 'held';
			this.releaseMotion?.(true);
			this.releaseMotion = undefined; this.rejectMotion = undefined;
		} catch (error) { if (generation === this.generation) this.fail(error); }
	}

	/** Bind before reveal; offscreen ownership transfers may commit after the visible replacement is complete. */
	async reveal(incoming: readonly HTMLElement[] = [], prepare?: (signal: AbortSignal) => void | Promise<void>,
		commit?: (signal: AbortSignal) => void | Promise<void>): Promise<void> {
		if (this.state !== 'held') return;
		this.state = 'revealing';
		const generation = this.generation;
		try {
			this.incoming = [...new Set(incoming)].map(saveFade);
			for (const entry of this.incoming) writeFade(entry, 0);
			await Promise.race([prepare?.(this.abort.signal), this.stopped]);
			if (generation !== this.generation) return;
			this.options.hooks.reveal(0);
			const started = performance.now();
			await new Promise<void>(resolve => {
				this.releaseReveal = resolve;
				const animate = (time: number) => {
					if (generation !== this.generation || this.state !== 'revealing') { resolve(); return; }
					try {
						const fraction = this.options.reducedMotion ? 1 : Math.min(1, Math.max(0, (time - started) / ASYNC_REVEAL_DURATION));
						const progress = easeInOutSine(fraction);
						for (const entry of this.incoming) writeFade(entry, progress);
						this.options.hooks.reveal(progress);
						if (fraction < 1) this.frame = requestAnimationFrame(animate);
						else { this.state = 'committing'; resolve(); }
					} catch (error) { this.fail(error); resolve(); }
				};
				this.frame = requestAnimationFrame(animate);
			});
			if (generation !== this.generation) return;
			await Promise.race([commit?.(this.abort.signal), this.stopped]);
			if (generation !== this.generation) return;
			this.complete();
		} catch (error) { if (generation === this.generation) this.fail(error); }
	}

	cancel(reason: EarlyNavigationCancelReason = 'cancelled') {
		if (this.state === 'complete' || this.state === 'cancelled') return;
		this.state = 'cancelled'; ++this.generation;
		this.abort.abort(); this.stopWaiting();
		cancelAnimationFrame(this.frame);
		this.releaseMotion?.(false); this.releaseMotion = undefined; this.rejectMotion = undefined;
		this.releaseReveal?.(); this.releaseReveal = undefined;
		this.cleanup();
		try { this.options.hooks.cancel(reason); } catch { /* Cleanup must remain idempotent. */ }
	}

	private fail(error: unknown) {
		try { this.options.hooks.error?.(error, this.state); } catch { /* Diagnostics cannot retain a failed transition. */ }
		const reject = this.rejectMotion;
		this.releaseMotion = undefined; this.rejectMotion = undefined;
		this.cancel('error');
		reject?.(error);
	}
	private restoreMotionStyles() {
		if (this.domStylesReleased) return;
		this.domStylesReleased = true;
		for (const motion of this.motions) motion?.restore();
	}
	private cleanup() {
		if (this.cleaned) return;
		this.cleaned = true;
		this.restoreMotionStyles();
		for (const entry of [...this.exits, ...this.incoming]) restoreFade(entry);
		for (const { element, inert } of this.interactivity) element.inert = inert;
	}
	private complete() {
		this.state = 'complete';
		this.cleanup();
		this.releaseReveal = undefined;
		this.options.hooks.finish();
	}
}
