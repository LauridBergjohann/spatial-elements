import { expect, it } from 'vitest';
import { resolveCarouselSelection, stepCarouselSelection } from './carouselSelection.js';
import { carouselPose } from './catalogPose.js';

it('handles empty, removed and single-item selections without synthetic duplicates', () => {
	expect(resolveCarouselSelection([])).toBeUndefined();
	expect(resolveCarouselSelection(['a'], 'removed')).toBe('a');
	expect(stepCarouselSelection(['a'], 'a', 1)).toBe('a');
	expect(stepCarouselSelection([], undefined, 1)).toBeUndefined();
	expect(() => resolveCarouselSelection(['a', 'a'])).toThrow('unique');
});

it('keeps two real spatialElements apart on an ordered arc', () => {
	const front = carouselPose(0, 0, 2);
	const back = carouselPose(1, 0, 2);
	expect(front.x).not.toBeCloseTo(back.x);
	expect(front.depth).toBeGreaterThan(back.depth);
	expect(carouselPose(0, 1, 2).x).toBeLessThan(front.x);
	expect(carouselPose(0, 0, 1).depth).toBeCloseTo(0);
});

it('clamps selection at both ends and restores a stable key after reordering', () => {
	expect(stepCarouselSelection(['a', 'b'], 'a', -1)).toBe('a');
	expect(stepCarouselSelection(['a', 'b', 'c'], 'c', 1)).toBe('c');
	expect(resolveCarouselSelection(['c', 'a', 'b'], 'b')).toBe('b');
});
