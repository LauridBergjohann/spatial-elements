import { getProjectiveCssMatrix3d, type CssProjectionQuad } from '../stage/cssProjection.js';
import { refineProjectedLayoutOffset } from './cardProjection.js';

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
	const panel = element.closest<HTMLElement>('[data-carousel-spatial-element] .summary');
	const frame = panel && frames.get(panel);
	if (!panel || !frame) return undefined;
	const projection = getProjectiveCssMatrix3d(frame.corners, frame.width, frame.height);
	if (!projection) return undefined;
	const borderBox = (node: HTMLElement) => {
		const style = getComputedStyle(node);
		const px = (name: string) => Number.parseFloat(style.getPropertyValue(name)) || 0;
		return { width: px('width') + (style.boxSizing === 'border-box' ? 0 : px('padding-left') + px('padding-right') + px('border-left-width') + px('border-right-width')),
			height: px('height') + (style.boxSizing === 'border-box' ? 0 : px('padding-top') + px('padding-bottom') + px('border-top-width') + px('border-bottom-width')) };
	};
	const chain: HTMLElement[] = [];
	for (let node = element; node !== panel;) {
		chain.push(node);
		const parent: Element | null = node.offsetParent;
		if (!(parent instanceof HTMLElement) || parent !== panel && !panel.contains(parent)) return undefined;
		node = parent;
	}
	let matrix = new DOMMatrix(projection);
	const panelSize = borderBox(panel);
	const projectedPanel = [[0, 0], [panelSize.width, 0], [panelSize.width, panelSize.height], [0, panelSize.height]]
		.map(([x, y]) => matrix.transformPoint(new DOMPoint(x, y)));
	const panelRect = panel.getBoundingClientRect();
	// Native document movement can precede the next submitted GPU frame. Keep the
	// cached projective plane but rebase its translation to the current source DOM.
	matrix = new DOMMatrix().translate(
		panelRect.left - Math.min(...projectedPanel.map(point => point.x / point.w)),
		panelRect.top - Math.min(...projectedPanel.map(point => point.y / point.w))
	).multiply(matrix);
	// The persistent island/query wrappers can introduce positioned and scrolling
	// ancestors. Resolve each actual local plane, retaining fractional CSS sizes.
	for (const node of chain.reverse()) {
		const style = getComputedStyle(node);
		if ([style.translate, style.rotate, style.scale].some(value => value && value !== 'none')) return undefined;
		const [x, y, z = 0] = style.transformOrigin.split(' ').map(Number.parseFloat);
		if (![x, y, z].every(Number.isFinite)) return undefined;
		const local = new DOMMatrix().translate(x, y, z)
			.multiply(new DOMMatrix(style.transform === 'none' ? undefined : style.transform)).translate(-x, -y, -z);
		const size = borderBox(node);
		const measured = node.getBoundingClientRect();
		const localCorners = [[0, 0], [size.width, 0], [size.width, size.height], [0, size.height]]
			.map(([cx, cy]) => local.transformPoint(new DOMPoint(cx, cy)));
		const offset = refineProjectedLayoutOffset(matrix.toFloat64Array(), localCorners,
			{ left: measured.left, top: measured.top }, { x: node.offsetLeft, y: node.offsetTop });
		matrix = matrix.translate(offset.x, offset.y).multiply(local);
	}
	const { width, height } = borderBox(element);
	if (!width || !height) return undefined;
	const corners = [
		[0, 0],
		[width, 0],
		[width, height],
		[0, height]
	].map(([x, y]) => {
		const point = matrix.transformPoint(new DOMPoint(x, y));
		return { x: point.x / point.w, y: point.y / point.w };
	}) as unknown as CssProjectionQuad;
	return { corners, width, height };
}
