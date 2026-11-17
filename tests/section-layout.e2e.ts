import { expect, test } from '@playwright/test';

test('inset L sections cap at 1536px, round grouped outer edges and align the detail submenu', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		for (const width of [1537, 1568, 1599]) {
			await page.setViewportSize({ width, height: 1000 });
			await page.goto('/demo/layout-sections');
			const first = page.locator('#surface-first');
			const box = (await first.boundingBox())!;
			expect(box.width).toBe(1536);
			expect(box.x).toBeCloseTo((width - 1536) / 2, 1);
			await expect(first.locator('.ps-section-surface')).not.toHaveCSS('border-top-left-radius', '0px');
			await expect(first.locator('.ps-section-surface')).toHaveCSS('border-bottom-left-radius', '0px');
			await page.goto('/demo/layout-pane');
			const content = (await page.locator('.spatial-element-section-list').boundingBox())!;
			const tabs = (await page.locator('.spatial-element-tabs-anchor').boundingBox())!;
			expect(content.width).toBe(1536);
			expect(tabs.x).toBeCloseTo(content.x, 1);
		}
	} finally { await context.close(); }
});

for (const javaScriptEnabled of [false, true]) test(`section surfaces and labels ${javaScriptEnabled ? 'after hydration' : 'without JS'}`, async ({ browser, baseURL }, info) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 2400, height: 1100 } });
	try {
		const page = await context.newPage();
		if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/demo/layout-sections');
		if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await expect(page.getByRole('region', { name: 'Visible headline' })).toBeVisible();
		await expect(page.getByRole('region', { name: 'Second navigation title' })).toBeVisible();
		await expect(page.locator('#surface-second h2')).toHaveCount(0);
		const samples = await page.locator('.content-section').evaluateAll(nodes => nodes.map(node => {
			const surface = node.querySelector('.ps-section-surface')!;
			const css = getComputedStyle(surface);
			return { id: node.id, padding: parseFloat(getComputedStyle(node.querySelector('.ps-section-content')!).paddingLeft),
				top: parseFloat(css.borderTopLeftRadius), bottom: parseFloat(css.borderBottomLeftRadius),
				background: css.backgroundColor, gradient: css.backgroundImage,
				width: surface.getBoundingClientRect().width,
				left: surface.getBoundingClientRect().left, right: surface.getBoundingClientRect().right };
		}));
		const byId = Object.fromEntries(samples.map(sample => [sample.id, sample]));
		expect(byId['surface-first'].top).toBeGreaterThan(0);
		expect(byId['surface-first'].bottom).toBe(0);
		expect(byId['surface-second'].top).toBe(0);
		expect(byId['surface-second'].bottom).toBeGreaterThan(0);
		expect(byId['surface-full'].gradient).toContain('linear-gradient');
		// Page Sections deliberately overdraws full surfaces inside the page's
		// clip, so their measured box can exceed the viewport.
		expect(byId['surface-full'].left).toBeLessThanOrEqual(0);
		expect(byId['surface-full'].right).toBeGreaterThanOrEqual(2400);
		expect(byId['surface-full'].top).toBe(0);
		expect(byId['surface-single'].top).toBeGreaterThan(0);
		expect(byId['surface-single'].bottom).toBeGreaterThan(0);
		expect(byId['surface-transparent'].background).toBe('rgba(0, 0, 0, 0)');
		expect(byId['surface-normalized'].gradient).toBe('none');
		expect(samples.every(sample => sample.padding === 24)).toBe(true);
		expect(await page.locator('.stage').evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgb(200, 216, 232)');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		await page.screenshot({ path: info.outputPath('section-surfaces.png'), fullPage: true });
		if (javaScriptEnabled) {
			await page.getByRole('button', { name: 'Toggle second surface' }).click();
			await expect.poll(() => page.locator('#surface-first .ps-section-surface').evaluate(el => parseFloat(getComputedStyle(el).borderBottomLeftRadius))).toBeGreaterThan(0);
		}
	} finally { await context.close(); }
});
