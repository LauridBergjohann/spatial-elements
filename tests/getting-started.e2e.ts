import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('minimal page-owned configuration works on entry, navigation and history', async ({
	page
}) => {
	const errors: string[] = [];
	const hdrRequests: string[] = [];
	page.on('request', (request) => {
		if (request.url().includes('/studio.hdr')) hdrRequests.push(new URL(request.url()).search);
	});
	page.on('pageerror', (error) => errors.push(error.message));
	await page.goto('/starter/categories/list?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const card = page.locator('[data-catalog-card]');
	await expect(card).toHaveAttribute('data-catalog-model-ready', '');
	expect(hdrRequests).toEqual(['?category=starter']);
	// Keep the diagnostic controller enabled on the fresh document after reload.
	await card.evaluate((link) =>
		link.setAttribute('href', `${link.getAttribute('href')}?stage-test=1`)
	);
	await card.click();
	await expect(page).toHaveURL(/starter\/elements\/cube/);
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
	await expect(page.locator('h1')).toHaveText('Cube');
	await expect
		.poll(() => page.evaluate(() => window.__stageVisualTest?.getModelRect()?.width ?? 0))
		.toBeGreaterThan(0);
	await expect(page.locator('.spatial-element-action')).toHaveCount(0);
	await expect
		.poll(() =>
			page.evaluate(() => window.__stageVisualTest?.getCatalogPresentation()?.representations.state)
		)
		.toBe('high');
	expect(
		await page.evaluate(
			() =>
				window.__stageVisualTest
					?.getCatalogStats()
					?.loadTimings.filter((load) => load.url.includes('/cube-high.glb')).length
		)
	).toBe(1);
	expect(hdrRequests).toContain('');
	await page.reload();
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect
		.poll(() => page.evaluate(() => window.__stageVisualTest?.getModelRect()?.width ?? 0))
		.toBeGreaterThan(0);
	await page.goBack();
	await expect(card).toHaveAttribute('data-catalog-model-ready', '');
	expect(errors).toEqual([]);
});

test('minimal document renders without JavaScript and unknown elements return 404', async ({
	browser,
	baseURL,
	request
}) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto(`${baseURL}/starter/categories/list`);
		await expect(page.locator('[data-catalog-poster]')).toBeVisible();
		await page.locator('[data-catalog-card]').click();
		await expect(page.locator('h1')).toHaveText('Cube');
		await expect(page.getByRole('link', { name: 'Back to the collection' })).toBeVisible();
	} finally {
		await context.close();
	}
	expect((await request.get('/starter/elements/missing')).status()).toBe(404);
});
