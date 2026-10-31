import { expect, test } from '@playwright/test';
import { resolveResponsiveLayout } from '../packages/core/src/spatial-element/responsiveLayout';

// Headless Chromium hides scrollbars by default. Stable gutters still reserve
// space in that mode, but clientWidth excludes no scrollbar, unlike real UI.
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
test('classic scrollbar gutters do not change viewport breakpoint selection', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-grid');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	await page.evaluate(() => {
		document.documentElement.style.scrollbarGutter = 'stable';
		document.documentElement.style.overflowY = 'scroll';
	});
	await expect(page.locator('html')).toHaveCSS('scrollbar-gutter', 'stable');
	for (const width of [1599, 1600, 1808, 1809]) {
		await page.setViewportSize({ width, height: 900 });
		await expect.poll(() => page.evaluate(() => innerWidth - document.documentElement.clientWidth)).toBeGreaterThan(0);
		const actual = await page.evaluate(() => ({
			width: innerWidth,
			scrollbarWidth: innerWidth - document.documentElement.clientWidth,
			content: document.querySelector('.content-page')!.getBoundingClientRect().toJSON(),
			xl: matchMedia('(min-width: 1600px)').matches
		}));
		expect(actual.scrollbarWidth).toBeGreaterThan(0);
		const expected = resolveResponsiveLayout({ width: actual.width, height: 900, scrollbarWidth: actual.scrollbarWidth });
		expect(expected.layout === 'xl' || expected.layout === '2xl').toBe(actual.xl);
		expect(Math.abs(actual.content.width - expected.content.width)).toBeLessThanOrEqual(1);
		expect(Math.abs(actual.content.x - expected.content.x)).toBeLessThanOrEqual(1);
	}
});
