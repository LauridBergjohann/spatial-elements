import { describe, expect, it } from 'vitest';
import { getMinimapBlurDirection, getMinimapBlurDownsampleSteps } from './MinimapBlurPipeline.js';

describe('minimap blur sampling', () => {
	it('disables the blur pyramid for a zero radius', () => {
		expect(getMinimapBlurDownsampleSteps(0, 2)).toBe(0);
		expect(getMinimapBlurDownsampleSteps(-10, 2)).toBe(0);
	});

	it('increases and caps pyramid depth for larger source-space radii', () => {
		expect(getMinimapBlurDownsampleSteps(10, 1)).toBe(1);
		expect(getMinimapBlurDownsampleSteps(10, 2)).toBe(2);
		expect(getMinimapBlurDownsampleSteps(500, 4)).toBe(5);
	});

	it('converts CSS pixels independently for each source axis', () => {
		const direction = getMinimapBlurDirection(10, 2, 1, 0);

		expect(direction.x).toBeCloseTo(4);
		expect(direction.y).toBeCloseTo(2);
	});

	it('compensates the Gaussian radius for blur-pyramid scale', () => {
		const fullResolution = getMinimapBlurDirection(10, 2, 2, 0);
		const quarterResolution = getMinimapBlurDirection(10, 2, 2, 2);

		expect(quarterResolution.x).toBeCloseTo(fullResolution.x / 4);
		expect(quarterResolution.y).toBeCloseTo(fullResolution.y / 4);
	});

	it('never returns negative or non-finite sample radii', () => {
		const direction = getMinimapBlurDirection(-10, -2, Number.NaN, -4);

		expect(direction.toArray()).toEqual([0, 0]);
	});
});
