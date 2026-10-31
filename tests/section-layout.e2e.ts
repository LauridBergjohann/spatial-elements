import { expect, test } from '@playwright/test';

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
			const surface = node.querySelector('.section-surface')!;
			const css = getComputedStyle(surface);
			return { id: node.id, padding: parseFloat(getComputedStyle(node).paddingLeft),
				top: parseFloat(css.borderTopLeftRadius), bottom: parseFloat(css.borderBottomLeftRadius),
				background: css.backgroundColor, gradient: css.backgroundImage,
				width: surface.getBoundingClientRect().width };
		}));
		const byId = Object.fromEntries(samples.map(sample => [sample.id, sample]));
		expect(byId['surface-first'].top).toBeGreaterThan(0);
		expect(byId['surface-first'].bottom).toBe(0);
		expect(byId['surface-second'].top).toBe(0);
		expect(byId['surface-second'].bottom).toBeGreaterThan(0);
		expect(byId['surface-full'].gradient).toContain('linear-gradient');
		expect(byId['surface-full'].width).toBe(2400);
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
			await expect.poll(() => page.locator('#surface-first .section-surface').evaluate(el => parseFloat(getComputedStyle(el).borderBottomLeftRadius))).toBeGreaterThan(0);
		}
	} finally { await context.close(); }
});
