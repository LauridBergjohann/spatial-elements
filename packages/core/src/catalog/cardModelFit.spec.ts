import { expect, it } from 'vitest';
import { cardModelFit } from './cardModelFit.js';

it('fits wide and tall geometry to the available rectangle including perspective', () => {
	for (const size of [[6, 1, 1], [1, 6, 1], [3, 3, 4]]) {
		const corners = [-1, 1].flatMap(x => [-1, 1].flatMap(y => [-1, 1].map(z =>
			({ x: x * size[0] / 2, y: y * size[1] / 2, z: z * size[2] / 2 }))));
		const scale = cardModelFit(corners, 320, 228);
		const extents = corners.map(p => ({ x: Math.abs(p.x * scale / (1 - p.z * scale / 1000)), y: Math.abs(p.y * scale / (1 - p.z * scale / 1000)) }));
		const width = Math.max(...extents.map(p => p.x)) * 2;
		const height = Math.max(...extents.map(p => p.y)) * 2;
		expect(width).toBeLessThanOrEqual(320 * 0.87 + 0.001);
		expect(height).toBeLessThanOrEqual(228 * 0.87 + 0.001);
		expect(Math.max(width / 320, height / 228)).toBeCloseTo(0.87);
	}
});
