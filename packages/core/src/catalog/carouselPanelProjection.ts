import { getProjectiveCssMatrix3d, type CssProjectionQuad } from '../stage/cssProjection.js';

const frames = new WeakMap<
	HTMLElement,
	{ corners: CssProjectionQuad; width: number; height: number }
>();

/** The last submitted frame survives page teardown without retaining the page. */
export function recordCarouselPanel(
	panel: HTMLElement,
	corners: CssProjectionQuad,
	width: number,
	height: number
) {
	frames.set(panel, { corners, width, height });
}

export function captureCarouselElement(element: HTMLElement) {
	const panel = element.closest<HTMLElement>('[data-carousel-product] .summary');
	const frame = panel && frames.get(panel);
	if (!panel || !frame) return undefined;
	if (element === panel) return frame;
	// Shared summary roles are direct children. Never guess a nested content transform.
	if (element.offsetParent !== panel) return undefined;
	const projection = getProjectiveCssMatrix3d(frame.corners, frame.width, frame.height);
	if (!projection) return undefined;
	const matrix = new DOMMatrix(projection);
	const { offsetLeft: x, offsetTop: y, offsetWidth: width, offsetHeight: height } = element;
	const corners = [
		[x, y],
		[x + width, y],
		[x + width, y + height],
		[x, y + height]
	].map(([x, y]) => {
		const point = matrix.transformPoint(new DOMPoint(x, y));
		return { x: point.x / point.w, y: point.y / point.w };
	}) as unknown as CssProjectionQuad;
	return { corners, width, height };
}
