import { expect, test } from '@playwright/test';
import { resolveDetailLayout } from '../packages/core/src/spatial-element/responsiveLayout';
test.use({ launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] } });
test('lower 2XL rail keeps its outer inset when the document has a scrollbar', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.setViewportSize({ width: 1809, height: 900 });
	await page.goto('/proof/detail-layout/default');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	await page.evaluate(() => { document.documentElement.style.scrollbarGutter = 'stable'; document.documentElement.style.overflowY = 'scroll'; });
	const actual = await page.evaluate(() => ({ scrollbarWidth: innerWidth - document.documentElement.clientWidth, rail: document.querySelector('.spatial-element-rail')!.getBoundingClientRect().toJSON(), first: document.querySelector('.spatial-element-media-anchor')!.getBoundingClientRect().toJSON() }));
	expect(actual.scrollbarWidth).toBeGreaterThan(0);
	const expected = resolveDetailLayout({ width: 1809, height: 900, scrollbarWidth: actual.scrollbarWidth });
	expect(Math.abs(actual.rail.x - expected.rail.rect.x)).toBeLessThan(1);
	expect(Math.abs(actual.rail.width - expected.rail.itemSize)).toBeLessThan(1);
	expect(Math.abs(actual.first.width - expected.rail.itemSize)).toBeLessThan(1);
	expect(Math.abs(actual.first.height - expected.rail.itemSize)).toBeLessThan(1);
});
