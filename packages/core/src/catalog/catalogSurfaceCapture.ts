/** Measured presentation and paint are independent of the endpoint's layout registration. */
export interface CatalogSurfaceCapture {
	corners?: import('../stage/cssProjection.js').CssProjectionQuad;
	bounds: HTMLElement;
	background: string;
	border: string;
	borderRadius: string;
	boxShadow: string;
}

export function captureCssSurface(
	bounds: HTMLElement,
	paint: HTMLElement = bounds,
	pseudo?: string
): CatalogSurfaceCapture {
	const style = getComputedStyle(paint, pseudo);
	return {
		bounds,
		background: style.background,
		border: style.border,
		borderRadius: getComputedStyle(bounds).borderRadius,
		boxShadow: style.boxShadow
	};
}
