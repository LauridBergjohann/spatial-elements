import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('without JavaScript the detail starts with the model poster and one media rail', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 390, height: 900 } });
	try {
		const page = await context.newPage();
		await page.goto('/demo/layout-media');
		await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-selected-media', 'minimap');
		await expect(page.locator('.spatial-element-rail')).toHaveCount(1);
		await expect(page.getByRole('button', { name: '3D view', exact: true })).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('[data-spatial-native-media]')).toHaveCount(0);
		expect(await page.locator('.spatial-element-visual img').count()).toBeGreaterThan(0);
	} finally { await context.close(); }
});

test('client navigation retains detail and minimap posters until the new geometry is ready', async ({ page }) => {
	let release!: () => void;
	const held = new Promise<void>(resolve => { release = resolve; });
	let requested = false;
	await page.route('**/assets/demo/column-low.glb', async route => {
		requested = true;
		await held;
		await route.continue();
	});
	try {
		await page.goto('/reading?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		await page.evaluate(() => {
			const link = document.querySelector<HTMLAnchorElement>('a[href="/curated"]')!;
			link.href = '/story/column';
			link.textContent = 'Load the uncached model';
		});
		await page.getByRole('link', { name: 'Load the uncached model' }).click();
		await expect(page).toHaveURL(/\/story\/column$/);
		await expect.poll(() => requested).toBe(true);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-stage-page-ready');
		await expect(page.locator('.stage-viewport-fallback-image')).toHaveCSS('opacity', '1');
		await expect(page.locator('.minimap-poster')).toHaveCSS('opacity', '1');
		release();
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '');
		await expect(page.locator('.stage-viewport-fallback-image')).toHaveCSS('opacity', '0');
		await expect(page.locator('.minimap-poster')).toHaveCSS('opacity', '0');
	} finally { release(); }
});

test('native media preserves aspect ratio, owns playback, reveals rail items and resets on history navigation', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.setViewportSize({ width: 390, height: 900 });
	await page.goto('/demo/layout-media');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	await page.getByRole('button', { name: 'Form illustration', exact: true }).click();
	const image = page.locator('[data-spatial-native-media="image"] img');
	await expect(image).toBeVisible();
	await expect(image).toHaveCSS('object-fit', 'contain');
	await page.getByRole('button', { name: 'Silent motion study', exact: true }).click();
	const video = page.locator('video');
	await expect.poll(() => video.evaluate(node => node.readyState)).toBeGreaterThanOrEqual(2);
	await video.evaluate(async node => { (window as any).__oldVideo = node; node.muted = true; await node.play(); });
	await expect.poll(() => video.evaluate(node => node.currentTime)).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Additional illustration 5', exact: true }).click();
	await expect(video).toHaveCount(0);
	expect(await page.evaluate(() => (window as any).__oldVideo.paused)).toBe(true);
	expect(await page.evaluate(() => (window as any).__oldVideo.getAttribute('src'))).toBeNull();
	expect(await page.locator('.spatial-element-rail').evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Unavailable image example', exact: true }).click();
	await expect(page.getByRole('status')).toContainText('media unavailable');
	await page.getByRole('link', { name: 'Return to the collection', exact: true }).click();
	await expect(page).toHaveURL(/\/demo\/categories\/list/);
	await page.goBack();
	await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-selected-media', 'minimap');
	await expect(page.locator('[data-spatial-native-media]')).toHaveCount(0);
	expect(errors).toEqual([]);
});

test('privacy embed is selected explicitly and destroyed when the model returns', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.route('https://www.youtube-nocookie.com/**', route => route.fulfill({ contentType: 'text/html', body: '<button>Player control</button>' }));
	await page.goto('/demo/layout-media');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	await expect(page.locator('iframe')).toHaveCount(0);
	await page.getByRole('button', { name: 'YouTube player demonstration', exact: true }).click();
	await expect(page.locator('iframe')).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?autoplay=0&rel=0');
	await page.frameLocator('iframe').getByRole('button', { name: 'Player control' }).click();
	await page.getByRole('button', { name: '3D view', exact: true }).click();
	await expect(page.locator('iframe')).toHaveCount(0);
});

test('WebGPU pauses the main 3D scene for native media and 3XL lets its free area scroll the document', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setViewportSize({ width: 2456, height: 900 });
	await page.goto('/demo/layout-media?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	await page.getByRole('button', { name: 'Form illustration', exact: true }).click();
	await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-selected-media', 'image');
	await expect(page.locator('[data-spatial-model-controls]')).toHaveAttribute('inert', '');
	await page.evaluate(() => window.__stageVisualTest!.settle(20));
	const before = await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses);
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	expect(await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses)).toBe(before);
	await page.mouse.move(550, 450);
	await page.mouse.wheel(0, 500);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
	await page.getByRole('button', { name: '3D view', exact: true }).click();
	await expect(page.locator('[data-spatial-model-controls]')).not.toHaveAttribute('inert', '');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	expect(await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses)).toBeGreaterThan(before);
	expect(errors).toEqual([]);
});
