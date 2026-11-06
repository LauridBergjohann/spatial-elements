import { expect, test } from '@playwright/test';
import { resolveContentGrid, resolveContentSpan, resolveResponsiveLayout } from '../packages/core/src/spatial-element/responsiveLayout';

for (const javaScriptEnabled of [false, true]) {
	test(`container grids retain their geometry ${javaScriptEnabled ? 'after hydration' : 'without JavaScript'}`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 1809, height: 900 } });
		try {
			const page = await context.newPage();
			if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/demo/layout-grid');
			if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
			const samples = await page.locator('[data-grid-sample]').evaluateAll(nodes => nodes.map(node => {
				const grid = node.querySelector<HTMLElement>('[data-grid]')!;
				return {
					width: node.getBoundingClientRect().width,
					columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
					gap: parseFloat(getComputedStyle(grid).columnGap),
					inset: parseFloat(getComputedStyle(node.firstElementChild!).paddingLeft),
					blocks: Array.from(grid.children).map(block => ({
						id: (block as HTMLElement).dataset.block,
						span: Number(getComputedStyle(block).gridColumnStart.replace('span ', '')),
						width: block.getBoundingClientRect().width
					}))
				};
			}));
			for (const sample of samples) {
				const grid = resolveContentGrid(sample.width);
				expect(sample.columns).toBe(grid.columns);
				expect(sample.gap).toBe(grid.gap);
				expect(sample.inset).toBe(grid.gap);
				for (const block of sample.blocks) {
					const requested = block.id === 'first' || block.id === 'second' ? { xs: 4, s: 3, m: 4, l: 6 }
						: block.id === 'inherited' ? { xs: 2, m: 3 } : block.id === 'clamped' ? 99 : block.id === 'invalid' ? 0 : undefined;
					const span = resolveContentSpan(requested, grid.size);
					expect(block.span).toBe(span);
					expect(Math.abs(block.width - (grid.columnWidth * span + (span - 1) * grid.gap))).toBeLessThanOrEqual(1);
				}
			}
			expect(new Set(samples.map(sample => sample.columns)).size).toBe(4);
		} finally { await context.close(); }
	});
}

test('ContentPage widths match the resolver and grids reflow at their container boundaries', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-grid');
	for (const width of [320, 599, 600, 839, 840, 1199, 1200, 1536, 1599, 1600, 1808, 1809, 2300, 3200]) {
		await page.setViewportSize({ width, height: 900 });
		const content = page.locator('.content-page');
		await expect.poll(async () => (await content.boundingBox())!.width).toBeCloseTo(resolveResponsiveLayout({ width, height: 900 }).content.width, 0);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	}
	await page.setViewportSize({ width: 1600, height: 900 });
	const sample = page.locator('[data-grid-sample="1536"]');
	for (const width of [599.5, 600, 600.5, 839.5, 840, 840.5, 1199.5, 1200, 1200.5]) {
		await sample.evaluate((element, width) => (element as HTMLElement).style.width = `${width}px`, width);
		await expect.poll(() => sample.locator('[data-grid]').evaluate(element => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(resolveContentGrid(width).columns);
	}
});

test('grid flow preserves authored focus order and leaves unused cells unfilled', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-grid');
	await page.locator('#order-first').focus();
	await page.keyboard.press('Tab');
	await expect(page.locator('#order-second')).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(page.locator('#order-third')).toBeFocused();
	const tops = await page.locator('[data-order-grid] > div').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
	expect(tops[1]).toBeGreaterThan(tops[0]);
	expect(tops[2]).toBeGreaterThan(tops[1]);
});
