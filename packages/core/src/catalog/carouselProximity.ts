/** Mouse approach is bounded and continuous outside the projected model bounds. */
export function carouselProximity(x: number, y: number,
	rect: { left: number; top: number; width: number; height: number }) {
	const dx = x - rect.left - rect.width / 2, dy = y - rect.top - rect.height / 2;
	const distance = Math.hypot(Math.max(0, Math.abs(dx) - rect.width / 2),
		Math.max(0, Math.abs(dy) - rect.height / 2));
	const t = Math.min(1, distance / 150);
	const influence = 1 - t * t * (3 - 2 * t);
	const limit = 4 * Math.PI / 180;
	return {
		x: Math.max(-1, Math.min(1, dy / Math.max(1, rect.height / 2))) * limit * influence,
		y: Math.max(-1, Math.min(1, dx / Math.max(1, rect.width / 2))) * limit * influence
	};
}
