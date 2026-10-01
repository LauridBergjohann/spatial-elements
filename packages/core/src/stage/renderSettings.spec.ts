import { describe, expect, it } from 'vitest';
import {
	DEFAULT_STAGE_RENDER_SETTINGS,
	getStageRenderPixelRatio,
	resolveStageRenderSettings
} from './renderSettings.js';

describe('stage render settings', () => {
	it('bounds high-DPI outputs by both density and physical pixel count', () => {
		expect(getStageRenderPixelRatio(800, 600, 2)).toBe(1);
		expect(getStageRenderPixelRatio(1500, 900, 2)).toBe(1);
		const ratio = getStageRenderPixelRatio(
			1500, 900, 2, resolveStageRenderSettings({ maxPixelRatio: 1.5 })
		);
		expect(1500 * 900 * ratio ** 2).toBeCloseTo(1920 * 1080);
		expect(getStageRenderPixelRatio(800, 600, 1)).toBe(1);
		expect(getStageRenderPixelRatio(3840, 2160, 2)).toBe(0.5);
	});

	it('supports a legacy density cap without an area budget', () => {
		const settings = resolveStageRenderSettings({ maxPixelRatio: 2, maxPixels: null });
		expect(getStageRenderPixelRatio(3000, 2000, 3, settings)).toBe(2);
		expect(getStageRenderPixelRatio(3000, 2000, 1, settings)).toBe(1);
	});

	it('resolves invalid settings and invalid viewport measurements safely', () => {
		for (const value of [undefined, NaN, Infinity, -1, 0]) {
			expect(resolveStageRenderSettings({ maxPixelRatio: value, maxPixels: value })).toEqual(
				DEFAULT_STAGE_RENDER_SETTINGS
			);
			expect(getStageRenderPixelRatio(value!, value!, value!)).toBe(1);
		}
		expect(resolveStageRenderSettings({ maxPixelRatio: 0.75, maxPixels: 100.9 })).toEqual({
			maxPixelRatio: 0.75,
			maxPixels: 100
		});
		expect(resolveStageRenderSettings({ maxPixels: 0.1 }).maxPixels).toBe(1);
	});
});
