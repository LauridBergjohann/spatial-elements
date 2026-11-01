export interface BackgroundCheckpoint {
	id: number;
	phase: string;
	width: number;
	height: number;
	dpr: number;
	/** Actual owner state for checkpoints whose DOM comparison must precede terminal fallback. */
	ownerMode?: string;
}

/** Fixture-only handshake. Its reader/release API performs no render or canvas copy. */
export function createBackgroundCheckpoints() {
	let sequence = 0, disposed = false;
	let pending: { value: BackgroundCheckpoint; resolve: () => void; reject: (error: Error) => void } | undefined;
	return {
		wait(value: Omit<BackgroundCheckpoint, 'id'>): Promise<void> {
			if (disposed) return Promise.reject(new Error('Background checkpoints disposed'));
			if (pending) return Promise.reject(new Error('Background checkpoint already pending'));
			return new Promise((resolve, reject) => { pending = { value: { ...value, id: ++sequence }, resolve, reject }; });
		},
		getCurrent(): BackgroundCheckpoint | undefined { return pending ? { ...pending.value } : undefined; },
		release(id: number): boolean {
			if (!pending || pending.value.id !== id) return false;
			const current = pending; pending = undefined; current.resolve(); return true;
		},
		dispose() {
			disposed = true;
			const current = pending; pending = undefined; current?.reject(new Error('Background checkpoints disposed'));
		}
	};
}

export type BackgroundCheckpointApi = Pick<ReturnType<typeof createBackgroundCheckpoints>, 'getCurrent' | 'release'>;
