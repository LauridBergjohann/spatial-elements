import { expect, test } from '@playwright/test';
import { resolveDetailLayout } from '../packages/core/src/spatial-element/responsiveLayout';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const javaScriptEnabled of [false, true]) {
	test(`3XL document layout and anchors work ${javaScriptEnabled ? 'with native hydration' : 'without JavaScript'}`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 2456, height: 900 } });
		try {
			const page = await context.newPage();
			if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/demo/layout-pane');
			if (javaScriptEnabled) await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane-clipped', '');
			for (const width of [2300, 2456, 3128, 3440]) {
				await page.setViewportSize({ width, height: 900 });
				const scrollbarWidth = await page.evaluate(() => innerWidth - document.documentElement.getBoundingClientRect().width);
				const expected = resolveDetailLayout({ width, height: 900, scrollbarWidth });
				await expect.poll(async () => {
					const body = (await page.locator('[data-spatial-detail-pane-body]').boundingBox())!;
					const media = (await page.locator('.spatial-element-visual').boundingBox())!;
					return Math.max(Math.abs(body.x - expected.content.x), Math.abs(body.width - expected.content.width),
						Math.abs(media.x - expected.mediaFit.x), Math.abs(media.y - expected.mediaFit.y),
						Math.abs(media.width - expected.mediaFit.width), Math.abs(media.height - expected.mediaFit.height));
				}).toBeLessThan(1);
				await expect.poll(() => page.locator('#pane-chapter-1').evaluate(node =>
					Number(getComputedStyle(node).getPropertyValue('--spatial-grid-columns')))).toBe(expected.grid.columns);
			}
			const tabs = page.locator('[data-spatial-element-tab-list]');
			await expect(tabs).toHaveCount(1);
			const paneBounds = (await page.locator('[data-spatial-detail-pane-body]').boundingBox())!;
			const tabBounds = (await tabs.boundingBox())!;
			expect(tabBounds.x + tabBounds.width / 2).toBeCloseTo(paneBounds.x + paneBounds.width / 2, 0);
			expect(tabBounds.width).toBeLessThanOrEqual(paneBounds.width);
			await tabs.locator('[href="#pane-chapter-4"]').click();
			await expect.poll(async () => (await page.locator('#pane-chapter-4').boundingBox())!.y).toBeCloseTo(182, 0);
			await page.reload();
			await expect.poll(async () => (await page.locator('#pane-chapter-4').boundingBox())!.y).toBeCloseTo(182, 0);
			await page.getByLabel('Chapter 6 note', { exact: true }).focus();
			await expect.poll(async () => {
				const bounds = (await page.getByLabel('Chapter 6 note', { exact: true }).boundingBox())!;
				return bounds.y >= 182 && bounds.y + bounds.height <= 840;
			}).toBe(true);
			await page.getByLabel('Chapter 6 note', { exact: true }).blur();
			await page.keyboard.press('Control+End');
			await expect.poll(async () => (await page.locator('[data-pane-last-line]').boundingBox())!.y).toBeLessThan(840);
			expect(await page.evaluate(() => document.scrollingElement === document.documentElement &&
				[...document.querySelectorAll('[data-spatial-detail-pane-body], main, section')].every(node => node.scrollTop === 0))).toBe(true);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			const header = (await page.locator('[data-spatial-detail-pane-header]').boundingBox())!;
			expect(header.y).toBeCloseTo(96, 0);
			await page.setViewportSize({ width: 2456, height: 500 });
			await expect(page.locator('[data-spatial-detail-media-region]')).toHaveCSS('position', 'relative');
		} finally { await context.close(); }
	});
}

test('3XL real WebGPU geometry stays fixed while pane DOM clips, grows and crosses 2XL', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setViewportSize({ width: 2456, height: 900 });
	await page.goto('/demo/layout-pane?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane-clipped', '');
	await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
	expect(await page.locator('[data-spatial-summary-root]').evaluate(node => Boolean(node.closest('[data-spatial-detail-pane-body]')))).toBe(true);
	await page.screenshot({ path: info.outputPath('pane-top.png') });
	await page.getByLabel('Retained pane value').fill('Still the same input');
	const inputIdentity = await page.getByLabel('Retained pane value').evaluate(node => { (window as any).__paneInput = node; return true; });
	expect(inputIdentity).toBe(true);
	const extentBefore = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.getByRole('button', { name: 'Toggle late pane content' }).click();
	await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(extentBefore + 10);
	const fitBefore = (await page.locator('.spatial-element-visual').boundingBox())!;
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const modelBefore = await page.evaluate(() => window.__stageVisualTest!.getModelRect()!);
	await page.locator('[data-spatial-element-tab-list] [href="#pane-chapter-4"]').click();
	await expect.poll(async () => (await page.locator('#pane-chapter-4').boundingBox())!.y).toBeCloseTo(182, 0);
	const fitAfter = (await page.locator('.spatial-element-visual').boundingBox())!;
	expect(fitAfter).toEqual(fitBefore);
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const modelAfter = await page.evaluate(() => window.__stageVisualTest!.getModelRect()!);
	for (const key of ['x', 'y', 'width', 'height'] as const)
		expect(Math.abs(modelAfter[key] - modelBefore[key]), `projected model ${key}`).toBeLessThan(1);
	await page.screenshot({ path: info.outputPath('pane-scrolled.png') });
	// No separately projected summary may escape the native pane clip.
	expect(await page.locator('[data-spatial-summary-root]').evaluate(node => Boolean(node.closest('[data-spatial-detail-pane-body]')))).toBe(true);
	const savedScroll = await page.evaluate(() => scrollY);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 1 }));
	await expect(page.locator('[data-spatial-detail-pane-body]')).toHaveAttribute('inert', '');
	await expect.poll(async () => (await page.locator('[data-spatial-detail-pane-body]').boundingBox())!.x).toBeGreaterThanOrEqual(2455);
	await page.evaluate(() => window.__stageVisualTest!.reset());
	await expect(page.locator('[data-spatial-detail-pane-body]')).not.toHaveAttribute('inert', '');
	await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(savedScroll, 0);
	await page.setViewportSize({ width: 2100, height: 900 });
	await expect(page.locator('[data-spatial-element-root]')).not.toHaveAttribute('data-spatial-detail-pane', '');
	await page.setViewportSize({ width: 2456, height: 900 });
	await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane', '');
	await expect.poll(async () => (await page.locator('#pane-chapter-4').boundingBox())!.y).toBeCloseTo(182, 0);
	await expect(page.getByLabel('Retained pane value')).toHaveValue('Still the same input');
	expect(await page.getByLabel('Retained pane value').evaluate(node => node === (window as any).__paneInput)).toBe(true);
	expect(await page.locator('[data-spatial-summary-root]').evaluate(node => Boolean(node.closest('[data-spatial-detail-pane-body]')))).toBe(true);
	await expect(page.locator('[data-spatial-element-tab-list]')).toHaveCount(1);
	expect(errors).toEqual([]);
});
