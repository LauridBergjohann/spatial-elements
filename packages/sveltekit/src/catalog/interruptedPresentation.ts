export interface InterruptedCatalogPresentation {
	finished: Promise<void>;
	cancel(): void;
}

/** Keep semantic ownership beyond a cancelled visual overlay, never beyond its route. */
export function finishInterruptedPresentation(options: {
	settle(): Promise<void>;
	adopt(): HTMLElement;
	release(): unknown;
}): InterruptedCatalogPresentation {
	let cancelled = false, released = false;
	const release = () => {
		if (released) return;
		released = true;
		options.release();
	};
	const finished = (async () => {
		try {
			await options.settle();
			if (cancelled) return;
			const slot = options.adopt();
			await options.settle();
			if (cancelled) return;
			slot.dispatchEvent(new Event('spatial-summary-measure'));
			await options.settle();
		} finally { release(); }
	})();
	// Destination model loading can still be pending before Stage joins this task.
	void finished.catch(() => {});
	return { finished, cancel() { cancelled = true; release(); } };
}
