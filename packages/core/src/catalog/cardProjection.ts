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

/** Keep the card's tilted, raised text in its original layout when navigation takes over. */
export function captureCardElement(element: HTMLElement) {
	const card = element.closest<HTMLElement>('[data-catalog-card]');
	if (!card) return;
	const { width, height } = borderBox(element);
	const cardSize = borderBox(card);
	if (!width || !height || !cardSize.width || !cardSize.height) return;
	let matrix = new DOMMatrix();
	for (let node = element; node !== card;) {
		matrix = new DOMMatrix().translate(node.offsetLeft, node.offsetTop)
			.multiply(localTransform(node)).multiply(matrix);
		const parent: Element | null = node.offsetParent;
		if (!(parent instanceof HTMLElement) || (parent !== card && !card.contains(parent))) return;
		node = parent;
	}
	const cardMatrix = localTransform(card);
	const cardCorners = project(cardMatrix, cardSize.width, cardSize.height);
	const rect = card.getBoundingClientRect();
	const x = rect.left - Math.min(...cardCorners.map((point) => point.x));
	const y = rect.top - Math.min(...cardCorners.map((point) => point.y));
	const corners = project(cardMatrix.multiply(matrix), width, height)
		.map((point) => ({ x: point.x + x, y: point.y + y })) as unknown as CssProjectionQuad;
	return { width, height, corners };
}
