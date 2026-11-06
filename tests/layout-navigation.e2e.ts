import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const cases = [
	{ width: 430, view: 'list', hash: false },
	{ width: 1440, view: 'carousel', hash: false },
	{ width: 1440, view: 'mixed', hash: true },
	{ width: 2456, view: 'list', hash: false },
	{ width: 2456, view: 'carousel', hash: false },
	{ width: 2456, view: 'mixed', hash: true }
] as const;

for (const scenario of cases) {
	test(`${scenario.width}px ${scenario.view} retains the existing ${scenario.hash ? 'section' : 'hero'} navigation and history`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.setViewportSize({ width: scenario.width, height: 1000 });
		await page.goto(`/demo/categories/${scenario.view}?stage-test=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
		const link = scenario.hash ? page.getByRole('link', { name: 'Explore the orb features' })
			: scenario.view === 'carousel' ? page.locator('[data-carousel-item].selected .spatial-element-target').first()
				: page.locator('[data-catalog-card][data-spatial-element-id="column"]').first();
		const expectedId = scenario.hash ? 'orb' : 'column';
		await link.scrollIntoViewIfNeeded();
		await link.hover();
		await page.evaluate(() => window.__stageVisualTest!.settle(24));
		const sourceScroll = await page.evaluate(() => scrollY);
		await link.click();
		await expect(page).toHaveURL(new RegExp(`/demo/elements/${expectedId}${scenario.hash ? '#features' : ''}$`));
		// The bounded preparation fallback can remove the transition marker
		// before asynchronous destination binding completes. This scenario tests
		// settled history; cancellation during binding is a separate contract.
		await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
		await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
		await expect(page.locator('[data-spatial-element-tab-list]')).toHaveCount(1);
		if (scenario.width >= 2300) {
			await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane', '');
			expect((await page.locator('.spatial-element-visual').boundingBox())!.y).toBeCloseTo(96, 0);
		}
		if (scenario.hash) {
			await expect(page.locator('#features')).toBeInViewport();
			if (scenario.width >= 2300) await expect.poll(() => page.locator('#features').evaluate(node => {
				const top = node.getBoundingClientRect().top;
				const maxScroll = Math.max(0, document.documentElement.scrollHeight - innerHeight);
				// Short pane content must retain native document limits; no extra
				// scroll area is invented just to top-align an already visible anchor.
				const expected = Math.max(182, top + scrollY - maxScroll);
				return Math.abs(top - expected);
			})).toBeLessThan(1);
			else await expect(page.locator('[data-spatial-element-sticky-header]')).toHaveAttribute('data-active', '');
		} else {
			await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getModelRect()?.width ?? 0)).toBeGreaterThan(20);
			if (scenario.width === 1440) await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.7, azimuth: 25 }));
		}
		await page.goBack();
		await expect(page).toHaveURL(new RegExp(`/demo/categories/${scenario.view}\\?stage-test=1$`));
		await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
		await expect(link).toBeVisible();
		await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(sourceScroll, 0);
		if (scenario.view === 'carousel') await expect(page.locator('[data-carousel-item="column"]')).toHaveClass(/selected/);
		await page.goForward();
		await expect(page).toHaveURL(new RegExp(`/demo/elements/${expectedId}${scenario.hash ? '#features' : ''}$`));
		await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
		await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
		expect(errors).toEqual([]);
	});
}
