import { expect, test } from '@playwright/test';
import { resolveDetailLayout } from '../packages/core/src/spatial-element/responsiveLayout';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('XL and 2XL breadcrumbs align with the content and authored view icons are used', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/proof/detail-layout/default');
	for (const width of [1600, 1750, 1809, 2100]) {
		await page.setViewportSize({ width, height: 900 });
		const scrollbarWidth = await page.evaluate(() => innerWidth - document.documentElement.getBoundingClientRect().width);
		const content = resolveDetailLayout({ width, height: 900, scrollbarWidth }).base.content;
		await expect.poll(async () => {
			const bounds = (await page.locator('.breadcrumbs').boundingBox())!;
			return Math.max(Math.abs(bounds.x - content.x), Math.abs(bounds.width - content.width));
		}).toBeLessThan(1.1);
	}
	await expect(page.locator('[data-spatial-view-icon="detail"] path')).toHaveCount(17);
	await expect(page.locator('[data-spatial-view-icon="fullscreen"] path')).toHaveCount(15);
});

test.describe('mobile document scrolling over detail UI', () => {
	test.use({ viewport: { width: 430, height: 820 }, hasTouch: true, isMobile: true });
	for (const selector of ['.spatial-element-rail', '[data-spatial-summary-root]']) {
		test(`a vertical touch over ${selector} reaches the document`, async ({ page, context }) => {
			await page.goto('/demo/layout-pane?stage-test=1');
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
			const region = page.locator(selector).first();
			await region.scrollIntoViewIfNeeded();
			await page.evaluate(() => window.__stageVisualTest!.settle(20));
			const bounds = (await region.boundingBox())!;
			const x = bounds.x + bounds.width / 2;
			const y = Math.min(700, Math.max(250, bounds.y + bounds.height / 2));
			expect(y).toBeGreaterThanOrEqual(bounds.y);
			expect(y).toBeLessThanOrEqual(bounds.y + bounds.height);
			const before = await page.evaluate(() => scrollY);
			const session = await context.newCDPSession(page);
			await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
			for (let step = 1; step <= 10; step++) {
				await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 15 }] });
				await page.waitForTimeout(16);
			}
			await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
			await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before + 30);
			await session.detach();
		});
	}
});
