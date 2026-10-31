import { expect, test } from 'vitest';
import { Matrix4, Vector4 } from 'three';
import { createSourceDomProjection } from './SourceDomMotion.js';
import type { CssProjectionQuad } from '../stage/cssProjection.js';

const width = 280, height = 180;
const box = [[0, 0], [width, 0], [width, height], [0, height]];
const project = (matrix: Matrix4) => box.map(([x, y]) => {
	const point = new Vector4(x, y, 0, 1).applyMatrix4(matrix);
	return { x: point.x / point.w, y: point.y / point.w };
}) as unknown as CssProjectionQuad;

test.each([0, 0.2, 0.5, 0.8, 1])('the original CSS3D parent and transform origin map exactly to the desired quad at %s', progress => {
	const parent = new Matrix4().makeTranslation(420, 160, 0)
		.multiply(new Matrix4().set(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -1 / 900, 1))
		.multiply(new Matrix4().makeRotationY(0.35)).multiply(new Matrix4().makeRotationX(-0.2));
	const local = new Matrix4().makeTranslation(140, 90, 0)
		.multiply(new Matrix4().makeRotationY(-0.15)).multiply(new Matrix4().makeTranslation(-140, -90, 0));
	const initial = parent.clone().multiply(local), corners = project(initial);
	const target = { left: 720, top: 120, width: 480 };
	const correction = createSourceDomProjection({ width, height, corners }, target)!;
	const actual = project(initial.multiply(correction(progress)!));
	const ends = [{ x: 720, y: 120 }, { x: 1200, y: 120 },
		{ x: 1200, y: 120 + height * 480 / width }, { x: 720, y: 120 + height * 480 / width }];
	for (let index = 0; index < 4; index++) {
		expect(actual[index].x).toBeCloseTo(corners[index].x + (ends[index].x - corners[index].x) * progress, 9);
		expect(actual[index].y).toBeCloseTo(corners[index].y + (ends[index].y - corners[index].y) * progress, 9);
	}
});

test('explicit target height permits the canonical dock surface while retaining the source content box', () => {
	const initial = new Matrix4().makeTranslation(20, 40, 0), corners = project(initial);
	const correction = createSourceDomProjection({ width, height, corners }, { left: 8, top: 8, width: 900, height: 80 })!;
	expect(project(initial.multiply(correction(1)!))).toEqual([
		{ x: 8, y: 8 }, { x: 908, y: 8 }, { x: 908, y: 88 }, { x: 8, y: 88 }
	]);
});

test('invalid or degenerate captures decline instead of applying a corrupt matrix', () => {
	const corners = project(new Matrix4());
	expect(createSourceDomProjection({ width: 0, height, corners }, { left: 0, top: 0, width: 100 })).toBeUndefined();
	expect(createSourceDomProjection({ width, height, corners }, { left: NaN, top: 0, width: 100 })).toBeUndefined();
	expect(createSourceDomProjection({ width, height, corners: [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }] },
		{ left: 0, top: 0, width: 100 })).toBeUndefined();
	const correction = createSourceDomProjection({ width, height, corners }, { left: 0, top: 0, width: 100 })!;
	expect(correction(NaN)).toBeUndefined();
	expect(correction(-1)?.elements).toEqual(correction(0)?.elements);
	expect(correction(2)?.elements).toEqual(correction(1)?.elements);
});
