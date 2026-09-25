export interface CssProjectionPoint {
	x: number;
	y: number;
}

export type CssProjectionQuad = readonly [
	CssProjectionPoint,
	CssProjectionPoint,
	CssProjectionPoint,
	CssProjectionPoint
];

/**
 * Returns a CSS matrix that maps a local rectangle onto a projected screen quad.
 *
 * Corners are ordered clockwise from the top-left. The resulting homography keeps
 * a flat DOM surface in the exact same perspective projection as its WebGPU plane.
 */
export function getProjectiveCssMatrix3d(
	corners: CssProjectionQuad,
	width: number,
	height: number
) {
	const safeWidth = Math.max(width, 0.000001);
	const safeHeight = Math.max(height, 0.000001);
	const [topLeft, topRight, bottomRight, bottomLeft] = corners;
	const deltaX1 = topRight.x - bottomRight.x;
	const deltaX2 = bottomLeft.x - bottomRight.x;
	const deltaX3 = topLeft.x - topRight.x + bottomRight.x - bottomLeft.x;
	const deltaY1 = topRight.y - bottomRight.y;
	const deltaY2 = bottomLeft.y - bottomRight.y;
	const deltaY3 = topLeft.y - topRight.y + bottomRight.y - bottomLeft.y;
	let projectiveX = 0;
	let projectiveY = 0;

	if (Math.abs(deltaX3) > 0.000001 || Math.abs(deltaY3) > 0.000001) {
		const determinant = deltaX1 * deltaY2 - deltaX2 * deltaY1;
		if (Math.abs(determinant) < 0.000001) return null;

		projectiveX = (deltaX3 * deltaY2 - deltaX2 * deltaY3) / determinant;
		projectiveY = (deltaX1 * deltaY3 - deltaX3 * deltaY1) / determinant;
	}

	const scaleX = topRight.x - topLeft.x + projectiveX * topRight.x;
	const shearX = bottomLeft.x - topLeft.x + projectiveY * bottomLeft.x;
	const scaleY = topRight.y - topLeft.y + projectiveX * topRight.y;
	const shearY = bottomLeft.y - topLeft.y + projectiveY * bottomLeft.y;
	const matrix = [
		scaleX / safeWidth,
		scaleY / safeWidth,
		0,
		projectiveX / safeWidth,
		shearX / safeHeight,
		shearY / safeHeight,
		0,
		projectiveY / safeHeight,
		0,
		0,
		1,
		0,
		topLeft.x,
		topLeft.y,
		0,
		1
	];
	if (matrix.some((value) => !Number.isFinite(value))) return null;

	return `matrix3d(${matrix.map((value) => (Math.abs(value) < 1e-10 ? 0 : value)).join(',')})`;
}
