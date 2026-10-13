import { expect, it } from 'vitest';
import { carouselProximity } from './carouselProximity.js';

it('leans toward the approaching pointer before hover and returns to rest outside reach', () => {
	const rect = { left: 200, top: 200, width: 200, height: 300 };
	expect(carouselProximity(300, 350, rect)).toEqual({ x: 0, y: 0 });
	const near = carouselProximity(430, 350, rect);
	expect(near.y).toBeGreaterThan(0);
	expect(carouselProximity(480, 350, rect).y).toBeLessThan(near.y);
	expect(carouselProximity(550, 350, rect)).toEqual({ x: 0, y: 0 });
	expect(carouselProximity(170, 350, rect).y).toBeCloseTo(-near.y);
	expect(Math.abs(carouselProximity(400, 500, rect).x)).toBeLessThanOrEqual(4 * Math.PI / 180);
});
