import { expect, test } from 'vitest';
import { compareLinearPixels, interiorPairs, pixelTolerance } from './pixelComparison.js';

test('the fixed binary16 bound distinguishes quantization from a material difference', () => {
	expect(pixelTolerance(1, 1)).toBe(4 / 1024);
	expect(pixelTolerance(0, 0)).toBe(2 ** -13);
	expect(compareLinearPixels([1 + 2 / 1024, 0, 0, 1], [1, 0, 0, 1]).equivalent).toBe(true);
	const changed = compareLinearPixels([1.02, 0, 0, 1], [1, 0, 0, 1]);
	expect(changed.equivalent).toBe(false);
	expect(changed.outsideTolerance).toBe(1);
	expect(changed.maxErrorIndex).toBe(0);
});

test('alpha, dark values and nonfinite readback cannot escape comparison', () => {
	expect(compareLinearPixels([0, 0, 0, 0.99], [0, 0, 0, 1]).equivalent).toBe(false);
	expect(compareLinearPixels([0.001, 0, 0, 1], [0, 0, 0, 1]).equivalent).toBe(false);
	expect(() => compareLinearPixels([NaN, 0, 0, 1], [0, 0, 0, 1])).toThrow('Nonfinite');
	expect(() => compareLinearPixels([], [])).toThrow('RGBA');
});

test('the predeclared samples include unequal interior reveal/refinement values', () => {
	expect(interiorPairs).toHaveLength(4);
	expect(interiorPairs.every(p => p.backgroundReveal > 0 && p.backgroundReveal < 1 && p.refinementProgress > 0 && p.refinementProgress < 1)).toBe(true);
	expect(interiorPairs.some(p => p.backgroundReveal !== p.refinementProgress)).toBe(true);
});
