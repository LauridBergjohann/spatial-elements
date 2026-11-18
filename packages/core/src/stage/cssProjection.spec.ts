import { expect, test } from 'vitest';
import { getProjectiveCssMatrix3d, getProjectiveCssMatrixElements, type CssProjectionQuad } from './cssProjection.js';

test.each([
	[{ x: 120, y: 80 }, { x: 520, y: 80 }, { x: 520, y: 280 }, { x: 120, y: 280 }],
	[{ x: 120, y: 80 }, { x: 510, y: 95 }, { x: 480, y: 320 }, { x: 110, y: 280 }]
].map(corners => ({ corners: corners as unknown as CssProjectionQuad })))('numeric and DOM projections map the same four corners without a serialization round trip', ({ corners }) => {
	const width = 400, height = 200;
	const elements = getProjectiveCssMatrixElements(corners, width, height)!;
	expect(getProjectiveCssMatrix3d(corners, width, height)).toBe(`matrix3d(${elements.join(',')})`);
	for (const [index, [x, y]] of [[0, 0], [width, 0], [width, height], [0, height]].entries()) {
		const w = elements[3] * x + elements[7] * y + elements[15];
		expect((elements[0] * x + elements[4] * y + elements[12]) / w).toBeCloseTo(corners[index].x, 9);
		expect((elements[1] * x + elements[5] * y + elements[13]) / w).toBeCloseTo(corners[index].y, 9);
	}
});

test('numeric projection preserves zero cleanup and rejects invalid quads like the DOM path', () => {
	const corners = [{ x: 1e-12, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }] as const;
	expect(getProjectiveCssMatrixElements(corners, 100, 100)![12]).toBe(0);
	const invalid = [{ x: NaN, y: 0 }, ...corners.slice(1)] as unknown as CssProjectionQuad;
	expect(getProjectiveCssMatrixElements(invalid, 100, 100)).toBeNull();
	expect(getProjectiveCssMatrix3d(invalid, 100, 100)).toBeNull();
});
