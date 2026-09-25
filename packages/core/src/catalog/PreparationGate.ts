/** Network work may continue while expensive decode/build/upload work is paused. */
export class PreparationGate {
	private paused = false;
	private waiters = new Set<() => void>();
	setPaused(paused: boolean) {
		this.paused = paused;
		if (!paused) for (const wake of [...this.waiters]) wake();
	}
	async wait(signal?: AbortSignal) {
		signal?.throwIfAborted();
		while (this.paused) {
			await new Promise<void>((resolve, reject) => {
				const cleanup = () => {
					this.waiters.delete(wake);
					signal?.removeEventListener('abort', abort);
				};
				const wake = () => {
					cleanup();
					resolve();
				};
				const abort = () => {
					cleanup();
					reject(signal?.reason);
				};
				this.waiters.add(wake);
				signal?.addEventListener('abort', abort, { once: true });
			});
			signal?.throwIfAborted();
		}
	}
	/** Check the gate and invoke work atomically; an awaited permission alone has a microtask race. */
	run<T>(work: () => T | Promise<T>, signal?: AbortSignal): Promise<T> {
		return new Promise((resolve, reject) => {
			const cleanup = () => {
				this.waiters.delete(start);
				signal?.removeEventListener('abort', abort);
			};
			const abort = () => {
				cleanup();
				reject(signal?.reason);
			};
			const start = () => {
				if (signal?.aborted) {
					abort();
					return;
				}
				if (this.paused) {
					this.waiters.add(start);
					return;
				}
				cleanup();
				try {
					resolve(work());
				} catch (error) {
					reject(error);
				}
			};
			signal?.addEventListener('abort', abort, { once: true });
			start();
		});
	}
}
