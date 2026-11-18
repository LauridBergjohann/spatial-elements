import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import { resolveSpatialElementDockLayout } from '../../packages/core/src/spatial-element/spatialElementDock';

if (process.env.SPATIAL_GPU) for (const [width, product] of [
	[390, 'exclusive/chronograph'], [700, 'exclusive/chronograph'],
	[1920, 'workbench/kraftform-kompakt'], [2100, 'exclusive/chronograph']
] as const) test(`showcase dock continuity: ${product} at ${width}px`, async ({ page }) => {
	await page.setViewportSize({ width, height: 900 });
	await page.goto(`/showcase/${product}/?stage-test=1`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	const dockTop = resolveSpatialElementDockLayout({ width, height: 900 })!.minimap.top;
	const result = await page.evaluate(async dockTop => {
		const api = window.__stageVisualTest!;
		await api.settle(20);
		const top = api.getMinimapRect()!.y - dockTop;
		const frames = [];
		// Cross both the arrival and release boundary without hiding intermediate frames.
		for (const offset of [-4, -3, -2, -1, 0, 1, 2, 3, 4, 3, 2, 1, 0, -1, -2, -3, -4]) {
			scrollTo({ top: top + offset, behavior: 'instant' });
			await api.settle(4);
			frames.push({ rect: api.getMinimapModelRect(), visible: api.getVisibilityStats().visibleMinimaps });
		}
		return frames;
	}, dockTop);
	for (let i = 0; i < result.length; i++) {
		expect(result[i].visible).toBe(1);
		expect(result[i].rect).not.toBeNull();
		if (!i) continue;
		expect(Math.abs(result[i].rect!.y - result[i - 1].rect!.y)).toBeLessThan(5);
		expect(Math.abs(result[i].rect!.height - result[i - 1].rect!.height)).toBeLessThan(5);
	}
});
