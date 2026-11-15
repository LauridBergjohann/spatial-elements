import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const width of [390, 700, 1200, 1600]) test(`Navigation uses the correct outer corners at ${width}px`, async ({ page }) => {
	await page.setViewportSize({ width, height: 900 });
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/showcase/workbench/kraftform-kompakt/');
	await expect(page.locator('.ps-navigation .header')).toHaveCSS('border-radius', width < 1600 ? '0px' : '12px');
});

if (process.env.SPATIAL_GPU) {
	for (const width of [390, 700]) test(`Reading preserves summary height and retained stage pixels at ${width}px`, async ({ page }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/workbench/kraftform-kompakt/?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		const read = () => page.evaluate(() => {
			const summary = document.querySelector('[data-spatial-summary-aside]')!.getBoundingClientRect();
			const sections = document.querySelector('.spatial-element-section-list')!.getBoundingClientRect();
			return { height: document.documentElement.scrollHeight, summaryHeight: summary.height,
				sectionTop: sections.top + scrollY, gap: sections.top - summary.bottom,
				stats: window.__stageVisualTest!.getVisibilityStats() };
		});
		const initial = await read();
		expect(initial.gap).toBeCloseTo(12, 0);
		for (const top of [500, 800, 1100, 1300, 1500, 1000, 500, 0]) {
			await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), top);
			await page.evaluate(() => window.__stageVisualTest!.settle(8));
			const actual = await read();
			expect(actual.height).toBe(initial.height);
			expect(actual.summaryHeight).toBe(initial.summaryHeight);
			expect(actual.sectionTop).toBeCloseTo(initial.sectionTop, 0);
		}
		await page.evaluate(() => scrollTo({ top: 1000, behavior: 'instant' }));
		await page.evaluate(() => window.__stageVisualTest!.settle(12));
		const before = await read();
		expect(before.stats.stageViewportVisible).toBe(false);
		// Returning from scroll quality to full quality can require one fresh capture.
		// Once that handoff settles, unchanged offscreen geometry must stop rendering.
		await expect.poll(async () => {
			const passes = (await read()).stats.stageModelRenderPasses;
			await page.evaluate(() => window.__stageVisualTest!.settle(24));
			return (await read()).stats.stageModelRenderPasses - passes;
		}).toBe(0);
		const scrollBefore = await page.evaluate(() => scrollY);
		await page.mouse.click(width / 2, 400);
		await page.evaluate(() => window.__stageVisualTest!.settle(8));
		expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
		await page.screenshot({ path: info.outputPath(`reading-${width}.png`) });
	});

	for (const width of [700, 1700]) test(`Breadcrumb follows the menu corner and minimap follows the zoom clock at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/workbench/kraftform-kompakt/?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		const measure = () => page.evaluate(() => ({
			menu: document.querySelector('[data-spatial-shell-menu]')!.getBoundingClientRect().toJSON(),
			crumb: document.querySelector('.spatial-element-pane-heading .breadcrumbs')!.getBoundingClientRect().toJSON()
		}));
		const start = await measure();
		await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.5 }, 30));
		const current = await measure();
		expect(current.crumb.x - start.crumb.x).toBeCloseTo(current.menu.x - start.menu.x, 0);
		expect(current.crumb.y - start.crumb.y).toBeCloseTo(current.menu.bottom - start.menu.bottom, 0);
		const state = await page.evaluate(() => window.__stageVisualTest!.getState());
		const t = Math.min(1, Math.max(0, (state.uiFocus - 0.08) / 0.88));
		const progress = t * t * (3 - 2 * t);
		if (width < 840) expect(state.minimapFocus).toBeCloseTo(progress, 6);
		else expect(Math.abs(state.minimapFocus - progress)).toBeLessThan(0.12);
	});

	test('Android desktop mode hides SpaceMouse controls', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(navigator, 'userAgentData', { value: { platform: 'Linux', mobile: false } });
			Object.defineProperty(navigator, 'platform', { value: 'Linux x86_64' });
			Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (X11; Linux x86_64)' });
			Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
		});
		await page.goto('/showcase/workbench/kraftform-kompakt/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		await expect(page.getByRole('button', { name: /connect spacemouse/i })).toHaveCount(0);
	});
}
