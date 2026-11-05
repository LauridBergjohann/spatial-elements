/** Match the stable layout space used by detail endpoints, not mobile browser chrome. */
export interface CatalogTransitionViewport {
	width: number;
	height: number;
	pixelRatio: number;
}

export function readCatalogTransitionViewport(): CatalogTransitionViewport {
	const probe = document.querySelector<HTMLElement>('[data-spatial-viewport-metrics]');
	return {
		width: window.innerWidth,
		height: probe?.getBoundingClientRect().height || window.innerHeight,
		pixelRatio: window.devicePixelRatio || 1
	};
}

export function catalogTransitionViewportChanged(before: CatalogTransitionViewport, after: CatalogTransitionViewport) {
	return Math.abs(before.width - after.width) > 0.5 ||
		Math.abs(before.height - after.height) > 0.5 || before.pixelRatio !== after.pixelRatio;
}
