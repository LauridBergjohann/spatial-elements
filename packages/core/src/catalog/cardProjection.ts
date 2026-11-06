import type { CssProjectionQuad } from '../stage/cssProjection.js';

function borderBox(element: HTMLElement) {
	const style = getComputedStyle(element);
	const px = (property: string) => Number.parseFloat(style.getPropertyValue(property)) || 0;
	return {
		width: px('width') + (style.boxSizing === 'border-box' ? 0 :
			px('padding-left') + px('padding-right') + px('border-left-width') + px('border-right-width')),
		height: px('height') + (style.boxSizing === 'border-box' ? 0 :
			px('padding-top') + px('padding-bottom') + px('border-top-width') + px('border-bottom-width'))
	};
}

function localTransform(element: HTMLElement) {
	const style = getComputedStyle(element);
	const [x, y, z = 0] = style.transformOrigin.split(' ').map(Number.parseFloat);
	return new DOMMatrix().translate(x, y, z)
		.multiply(new DOMMatrix(style.transform === 'none' ? undefined : style.transform))
		.translate(-x, -y, -z);
}

function project(matrix: DOMMatrix, width: number, height: number): CssProjectionQuad {
	return [[0, 0], [width, 0], [width, height], [0, height]].map(([x, y]) => {
		const point = matrix.transformPoint(new DOMPoint(x, y));
		return { x: point.x / point.w, y: point.y / point.w };
	}) as unknown as CssProjectionQuad;
}

interface ProjectivePoint { x: number; y: number; z: number; w: number }

/**
 * Recover subpixel layout offsets without flattening the CSS perspective plane.
 * offsetLeft/Top round to integer CSS pixels; a centered flex child need not.
 * For each extremal corner, screenPosition = numerator / homogeneousW. Moving
 * its local origin gives two linear equations after multiplying by homogeneousW.
 * Re-evaluate extrema because a perspective translation can change the corner.
 * @internal
 */
export function refineProjectedLayoutOffset(
	parent: ArrayLike<number>,
	localCorners: readonly ProjectivePoint[],
	target: { left: number; top: number },
	initial: { x: number; y: number }
) {
	const bases = localCorners.map(point => ({
		x: parent[0] * point.x + parent[4] * point.y + parent[8] * point.z + parent[12] * point.w,
		y: parent[1] * point.x + parent[5] * point.y + parent[9] * point.z + parent[13] * point.w,
		w: parent[3] * point.x + parent[7] * point.y + parent[11] * point.z + parent[15] * point.w,
		localW: point.w
	}));
	let offset = initial;
	for (let iteration = 0; iteration < 4; iteration++) {
		const projected = bases.map(point => {
			const w = point.w + (parent[3] * offset.x + parent[7] * offset.y) * point.localW;
			return {
				x: (point.x + (parent[0] * offset.x + parent[4] * offset.y) * point.localW) / w,
				y: (point.y + (parent[1] * offset.x + parent[5] * offset.y) * point.localW) / w
			};
		});
		const left = bases[projected.reduce((index, point, next) => point.x < projected[index].x ? next : index, 0)];
		const top = bases[projected.reduce((index, point, next) => point.y < projected[index].y ? next : index, 0)];
		if (!left || !top) return initial;
		const a = (parent[0] - target.left * parent[3]) * left.localW;
		const b = (parent[4] - target.left * parent[7]) * left.localW;
		const c = (parent[1] - target.top * parent[3]) * top.localW;
		const d = (parent[5] - target.top * parent[7]) * top.localW;
		const rx = target.left * left.w - left.x;
		const ry = target.top * top.w - top.y;
		const determinant = a * d - b * c;
		if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) return initial;
		const next = { x: (rx * d - b * ry) / determinant, y: (a * ry - rx * c) / determinant };
		if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) return initial;
		if (Math.abs(next.x - offset.x) + Math.abs(next.y - offset.y) < 1e-7) return next;
		offset = next;
	}
	return offset;
}

/** Keep the card's tilted, raised text in its original layout when navigation takes over. */
export function captureCardElement(element: HTMLElement) {
	const card = element.closest<HTMLElement>('[data-catalog-card]');
	if (!card) return;
	return captureElementPlane(element, card);
}

/** Capture a nested element relative to a known planar root (also used after a live-root transfer). */
export function captureElementPlane(element: HTMLElement, card: HTMLElement) {
	const { width, height } = borderBox(element);
	const cardSize = borderBox(card);
	if (!width || !height || !cardSize.width || !cardSize.height) return;
	const chain: HTMLElement[] = [];
	for (let node = element; node !== card;) {
		chain.push(node);
		const parent: Element | null = node.offsetParent;
		if (!(parent instanceof HTMLElement) || (parent !== card && !card.contains(parent))) return;
		node = parent;
	}
	const cardMatrix = localTransform(card);
	const cardCorners = project(cardMatrix, cardSize.width, cardSize.height);
	const rect = card.getBoundingClientRect();
	const x = rect.left - Math.min(...cardCorners.map((point) => point.x));
	const y = rect.top - Math.min(...cardCorners.map((point) => point.y));
	let matrix = cardMatrix;
	for (const node of chain.reverse()) {
		const local = localTransform(node);
		const size = borderBox(node);
		const measured = node.getBoundingClientRect();
		const localCorners = [[0, 0], [size.width, 0], [size.width, size.height], [0, size.height]]
			.map(([cx, cy]) => local.transformPoint(new DOMPoint(cx, cy)));
		const offset = refineProjectedLayoutOffset(matrix.toFloat64Array(), localCorners,
			{ left: measured.left - x, top: measured.top - y }, { x: node.offsetLeft, y: node.offsetTop });
		matrix = matrix.translate(offset.x, offset.y).multiply(local);
	}
	const corners = project(matrix, width, height)
		.map((point) => ({ x: point.x + x, y: point.y + y })) as unknown as CssProjectionQuad;
	return { width, height, corners };
}
