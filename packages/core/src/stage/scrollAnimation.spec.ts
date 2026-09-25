import { describe, expect, it } from 'vitest';
import { easeStageAnchorScroll } from './scrollAnimation.js';

describe('stage anchor scroll animation', () => {
	it('clamps progress and eases toward the target', () => {
		expect(easeStageAnchorScroll(-1)).toBe(0);
		expect(easeStageAnchorScroll(0.5)).toBeCloseTo(0.875);
		expect(easeStageAnchorScroll(1)).toBe(1);
		expect(easeStageAnchorScroll(2)).toBe(1);
	});
});
