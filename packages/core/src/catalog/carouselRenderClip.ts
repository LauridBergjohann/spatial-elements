import type { BlurRect } from './CatalogDepthBlur.js';

/** Standard-width surfaces can be overflown; full-width backgrounds separate scenes. */
export function carouselRenderClip(surface: BlurRect, fullSurfaces: readonly BlurRect[],
	viewportWidth: number, documentTop: number, documentBottom: number, ownFull: boolean): BlurRect {
	if (ownFull) return { ...surface };
	let top = documentTop, bottom = documentBottom;
	for (const other of fullSurfaces) {
		const end = other.top + other.height;
		if (end <= surface.top + 1) top = Math.max(top, end);
		if (other.top >= surface.top + surface.height - 1) bottom = Math.min(bottom, other.top);
	}
	return { left: 0, top, width: viewportWidth, height: Math.max(0, bottom - top) };
}
