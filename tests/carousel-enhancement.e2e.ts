import { expect, test } from '@playwright/test';

for (const width of [1440, 430]) for (const javaScriptEnabled of [false, true]) {
	test(`native carousel at ${width}px, JavaScript ${javaScriptEnabled}`, async ({ browser, baseURL }) => {
		test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Requires independently loaded production CSS');
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width, height: 900 } });
		try {
			await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			const page = await context.newPage();
			await page.goto('/demo/categories/carousel');
			if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
			const carousel = page.locator('[data-carousel-section]').first();
			const rail = carousel.locator('.ring');
			await expect(rail).toHaveCSS('overflow-x', 'auto');
			expect(await rail.evaluate(el => el.scrollWidth / el.clientWidth)).toBeCloseTo(5, 1);
			expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
			const before = await rail.evaluate(el => el.clientHeight);
			await carousel.locator('.controls a').nth(2).click();
			await expect.poll(() => rail.evaluate(el => el.scrollLeft / el.clientWidth)).toBeCloseTo(2, 1);
			expect(await rail.evaluate(el => el.clientHeight)).toBe(before);
			await carousel.locator('[data-carousel-item="ring"] .information').first().click();
			await expect(page).toHaveURL(/elements\/ring/);
		} finally { await context.close(); }
	});
}

test('selection made before GPU availability survives enhancement', async ({ page }) => {
	await page.addInitScript(() => {
		const gpu = navigator.gpu;
		const request = gpu.requestAdapter.bind(gpu);
		let resume!: () => void;
		const ready = new Promise<void>(resolve => { resume = resolve; });
		Object.assign(window, { resumeGPU: resume });
		gpu.requestAdapter = async options => { await ready; return request(options); };
	});
	await page.goto('/demo/categories/carousel?stage-test=1');
	const carousel = page.locator('[data-carousel-section]').first();
	const rail = carousel.locator('.ring');
	await expect(carousel).not.toHaveClass(/interactive/);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'loading');
	await rail.evaluate(el => el.scrollTo({ left: el.clientWidth * 2, behavior: 'instant' }));
	await expect(carousel.locator('.controls a').nth(2)).toHaveAttribute('aria-current', 'true');
	const height = await rail.evaluate(el => el.clientHeight);
	await page.evaluate(() => (window as unknown as { resumeGPU(): void }).resumeGPU());
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(carousel.locator('[data-carousel-item="ring"]')).toHaveClass(/selected/);
	await expect(carousel.locator('[data-carousel-item="ring"]')).toHaveAttribute('data-catalog-model-ready');
	await expect(carousel.locator('.controls button').nth(2)).toHaveAttribute('aria-pressed', 'true');
	expect(await rail.evaluate(el => el.clientHeight)).toBe(height);
	expect(await rail.evaluate(el => el.scrollLeft)).toBe(0);
});

test('selection made in server HTML survives hydration and device loss', async ({ page }) => {
	test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Requires production CSS before hydration');
	let releaseScripts!: () => void;
	const scripts = new Promise<void>(resolve => { releaseScripts = resolve; });
	await page.route('**/*', async route => {
		if (route.request().resourceType() === 'script') await scripts;
		await route.continue();
	});
	try {
		await page.goto('/demo/categories/carousel?stage-test=1', { waitUntil: 'commit' });
		const carousel = page.locator('[data-carousel-section]').first();
		const rail = carousel.locator('.ring');
		await expect(rail).toHaveCSS('overflow-x', 'auto');
		await rail.evaluate(el => el.scrollTo({ left: el.clientWidth * 2, behavior: 'instant' }));
		await expect.poll(() => rail.evaluate(el => el.scrollLeft / el.clientWidth)).toBeCloseTo(2, 1);
		const height = await rail.evaluate(el => el.clientHeight);
		releaseScripts();
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const selected = carousel.locator('[data-carousel-item="ring"]');
		await expect(selected).toHaveClass(/selected/);
		await expect(selected).toHaveAttribute('data-catalog-model-ready');
		await page.evaluate(() => window.__stageVisualTest!.loseDevice());
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await expect(rail).toHaveCSS('overflow-x', 'auto');
		await expect.poll(() => rail.evaluate(el => el.scrollLeft / el.clientWidth)).toBeCloseTo(2, 1);
		await expect(carousel.locator('.controls a').nth(2)).toHaveAttribute('aria-current', 'true');
		expect(await rail.evaluate(el => el.clientHeight)).toBe(height);
		const target = selected.locator('.spatial-element-target');
		const poster = selected.locator('.spatial-element-poster');
		await expect(poster).toHaveCSS('opacity', '1');
		const [hitbox, image] = await Promise.all([target.boundingBox(), poster.boundingBox()]);
		expect(hitbox).toEqual(image);
		await target.click();
		await expect(page).toHaveURL(/elements\/ring/);
	} finally { releaseScripts(); }
});
