/** Fit the authored view into its rectangular slot, including perspective foreshortening. */
export function cardModelFit(
	corners: readonly { x: number; y: number; z: number }[],
	width: number,
	height: number,
	fill = 0.87,
	distance = 1000
) {
	const halfWidth = Math.max(width, 1) * fill / 2;
	const halfHeight = Math.max(height, 1) * fill / 2;
	let scale = Infinity;
	for (const point of corners) {
		const x = Math.abs(point.x) + halfWidth * point.z / distance;
		const y = Math.abs(point.y) + halfHeight * point.z / distance;
		if (x > 0) scale = Math.min(scale, halfWidth / x);
		if (y > 0) scale = Math.min(scale, halfHeight / y);
	}
	return Number.isFinite(scale) ? Math.max(0, scale) : 1;
}
