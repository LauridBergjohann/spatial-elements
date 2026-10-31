import { expect, test } from 'vitest';
import { Matrix4, Vector4 } from 'three';
import { refineProjectedLayoutOffset } from './cardProjection.js';

const vertices = [[0, 0], [204, 0], [204, 20], [0, 20]];
const perspective = new Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / 1000, 1);

test.each([
	{ x: 4, y: 22.5, pitch: 0, yaw: 0, roll: 0 },
	{ x: 4.375, y: 22.5, pitch: 0.12, yaw: -0.09, roll: 0.06 },
	{ x: 18.125, y: 43.625, pitch: -0.25, yaw: 0.3, roll: -0.15 },
	{ x: -3.5, y: 70.375, pitch: 0.1, yaw: 0.15, roll: 1.65 }
])('recovers fractional layout in a projected CSS plane: %j', ({ x, y, pitch, yaw, roll }) => {
	const parent = perspective.clone()
		.multiply(new Matrix4().makeTranslation(18, 31, 0))
		.multiply(new Matrix4().makeRotationX(pitch))
		.multiply(new Matrix4().makeRotationY(yaw))
		.multiply(new Matrix4().makeRotationZ(roll));
	const local = new Matrix4().makeTranslation(0, 0, 64)
		.multiply(new Matrix4().makeRotationZ(-0.03));
	const actual = parent.clone().multiply(new Matrix4().makeTranslation(x, y, 0)).multiply(local);
	const projected = vertices.map(([vx, vy]) => {
		const point = new Vector4(vx, vy, 0, 1).applyMatrix4(actual);
		return { x: point.x / point.w, y: point.y / point.w };
	});
	const target = { left: Math.min(...projected.map(point => point.x)), top: Math.min(...projected.map(point => point.y)) };
	const result = refineProjectedLayoutOffset(parent.elements,
		vertices.map(([vx, vy]) => new Vector4(vx, vy, 0, 1).applyMatrix4(local)), target,
		{ x: Math.round(x), y: Math.round(y) });
	expect(result.x).toBeCloseTo(x, 7);
	expect(result.y).toBeCloseTo(y, 7);
});

test('does not create invalid offsets for a degenerate parent projection', () => {
	const initial = { x: 3, y: 7 };
	expect(refineProjectedLayoutOffset(new Array(16).fill(0),
		vertices.map(([x, y]) => ({ x, y, z: 0, w: 1 })), { left: 0, top: 0 }, initial)).toEqual(initial);
});
