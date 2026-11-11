export interface ScrollWarmupCheckpointState {
	id: number;
	name: string;
	dpr: number;
}

/** Fixture-only handshake: no rendering advances until the harness has captured pixels. */
export function createScrollWarmupCheckpoints() {
	let sequence = 0,
		disposed = false;
	let pending:
		| { state: ScrollWarmupCheckpointState; resolve: () => void; reject: (error: Error) => void }
		| undefined;
	return {
		wait(name: string, dpr: number): Promise<void> {
			if (disposed) return Promise.reject(new Error('Scroll warmup checkpoints disposed'));
			if (pending) return Promise.reject(new Error('Scroll warmup checkpoint already pending'));
			return new Promise((resolve, reject) => {
				pending = { state: { id: ++sequence, name, dpr }, resolve, reject };
			});
		},
		getCurrent(): ScrollWarmupCheckpointState | undefined {
			return pending ? { ...pending.state } : undefined;
		},
		release(id: number): boolean {
			if (!pending || pending.state.id !== id) return false;
			const current = pending;
			pending = undefined;
			current.resolve();
			return true;
		},
		dispose() {
			disposed = true;
			const current = pending;
			pending = undefined;
			current?.reject(new Error('Scroll warmup checkpoints disposed'));
		}
	};
}

export type ScrollWarmupCheckpointApi = Pick<
	ReturnType<typeof createScrollWarmupCheckpoints>,
	'getCurrent' | 'release'
>;
