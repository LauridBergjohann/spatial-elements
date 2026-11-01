import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

// Functional eligibility/zoom evidence, deliberately separate from performance cohorts.
for (const view of ['list', 'carousel']) test(`${view} uses masked scroll warming on its real Low-only Hero and keeps zoom usable`, async ({ page }, info) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	let release!: () => void;
	const heldHigh = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/column-high.glb', async route => {
		await heldHigh; await route.continue().catch(() => {});
	});
	try {
		await page.goto(`/demo/categories/${view}?stage-test=1&stagedNavigation=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
			: page.locator('[data-carousel-item="column"] .spatial-element-target');
		await link.hover();
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
		const before = await page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats().maskedScrollWarmups);
		await link.click();
		await expect(page).toHaveURL(/\/demo\/elements\/column$/);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().early?.revealed ?? 0)).toBeGreaterThan(0);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats().maskedScrollWarmups)).toBeGreaterThan(before);
		const hit = await page.evaluate(() => ({ stats: window.__stageVisualTest!.getRenderTargetStats(),
			presentation: window.__stageVisualTest!.getCatalogPresentation(), timings: window.__stageVisualTest!.getNavigationTimings() }));
		expect(hit.stats.maskedScrollWarmups - before).toBe(1);
		release();
		const minimapPasses = await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().minimapSceneRenderPasses);
		await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.6, azimuth: 25 }, 60));
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeGreaterThan(0.3);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().minimapSceneRenderPasses)).toBeGreaterThan(minimapPasses);
		expect((await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()))!.width).toBeGreaterThan(20);
		await writeFile(info.outputPath('deferred-scroll-navigation.json'), JSON.stringify({ view, intentionallyHeldHigh: true, ...hit }, null, 2));
		expect(errors).toEqual([]);
	} finally { release(); }
});
