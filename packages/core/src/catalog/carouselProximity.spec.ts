import { expect, it } from 'vitest';
import { carouselProximity } from './carouselProximity.js';
import * as THREE from 'three/webgpu';

it('leans toward the approaching pointer before hover and returns to rest outside reach', () => {
	const rect = { left: 200, top: 200, width: 200, height: 300 };
	expect(carouselProximity(300, 350, rect)).toEqual({ x: 0, y: 0 });
	const near = carouselProximity(430, 350, rect);
	expect(near.y).toBeLessThan(0);
	expect(Math.abs(carouselProximity(480, 350, rect).y)).toBeLessThan(Math.abs(near.y));
	expect(carouselProximity(550, 350, rect)).toEqual({ x: 0, y: 0 });
	expect(carouselProximity(170, 350, rect).y).toBeCloseTo(-near.y);
	expect(Math.abs(carouselProximity(400, 500, rect).x)).toBeLessThanOrEqual(4 * Math.PI / 180);
});

it('brings the approached corner toward the camera on all four corners', () => {
	const rect = { left: 0, top: 0, width: 200, height: 200 };
	for (const x of [-1, 1]) for (const y of [-1, 1]) {
		const tilt = carouselProximity(100 + x * 100, 100 - y * 100, rect);
		const corner = new THREE.Vector3(x, y, 0).applyEuler(new THREE.Euler(tilt.x, tilt.y, 0));
		expect(corner.z).toBeGreaterThan(0);
	}
});
