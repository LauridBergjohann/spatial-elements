import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const fullscreen = (page: Page) => page.getByRole('button', { name: 'Fullscreen', exact: true });
const detail = (page: Page) => page.getByRole('button', { name: 'Detail view', exact: true });
const orientation = (page: Page) => page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!.live);
const difference = (a: number[], b: number[]) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));
async function open(page: Page) {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(fullscreen(page)).toBeVisible();
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
}
async function expectFullscreen(page: Page) {
	await expect(fullscreen(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-minimap-focus', '1.000');
	await expect(page.locator('.stage-webgpu-background')).toHaveCSS('touch-action', 'none');
	await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toBeVisible();
}

test('native fullscreen keeps only the viewer tools and supports background navigation, minimap and SpaceMouse', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await open(page);
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(fullscreen(page)).toHaveAttribute('title', 'Fullscreen');
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 1 }));
	const closeMinimap = await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()!);
	await page.evaluate(() => window.__stageVisualTest!.reset());
	await page.screenshot({ path: info.outputPath('detail-view-toggle.png') });
	await fullscreen(page).click();
	await expectFullscreen(page);
	await expect.poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains('stage'))).toBe(true);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const expanded = await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()!);
	expect(expanded.width).toBeCloseTo(closeMinimap.width, 0);
	expect(expanded.height).toBeCloseTo(closeMinimap.height, 0);
	expect(expanded.x).toBeCloseTo(closeMinimap.x, 0);
	await page.screenshot({ path: info.outputPath('fullscreen.png') });
	const toolRects = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-spatial-element-view-toggle] button')).map((button) => button.getBoundingClientRect().toJSON()));
	const helpRect = (await page.getByRole('button', { name: '3D controls', exact: true }).boundingBox())!;
	expect(toolRects[0].x - helpRect.x - helpRect.width).toBeCloseTo(8, 0);
	expect(toolRects[1].x - toolRects[0].x).toBeCloseTo(40, 0);
	const point = { x: 20, y: 450 };
	expect(await page.evaluate((point) => document.elementFromPoint(point.x, point.y)?.classList.contains('stage-webgpu-background'), point)).toBe(true);
	const before = await orientation(page);
	await page.mouse.move(point.x, point.y);
	await page.mouse.down();
	await page.mouse.move(point.x + 140, point.y + 70, { steps: 12 });
	await page.mouse.up();
	await expect.poll(async () => difference(before, await orientation(page))).toBeGreaterThan(0.02);
	await page.mouse.wheel(0, -650);
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeGreaterThan(0.02);
	await page.evaluate(() => window.__stageVisualTest!.setSpaceMouseZoom(0.8));
	const minimap = await page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!);
	expect(difference(minimap.display, minimap.live)).toBeLessThan(0.0001);
	await page.screenshot({ path: info.outputPath('fullscreen-zoomed.png') });
	await page.getByRole('button', { name: '3D controls', exact: true }).click();
	await expect(page.locator('[data-spatial-element-help]')).toBeVisible();
	await page.getByRole('button', { name: 'Close help', exact: true }).click();
	await detail(page).click();
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeLessThan(0.001);
	await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
	await fullscreen(page).click();
	await page.evaluate(() => document.exitFullscreen());
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
	expect(errors).toEqual([]);
});

test('detail selection fades with zoom and the detail button always restores the fitted view', async ({ page }) => {
	await open(page);
	const selection = () => detail(page).evaluate((button) => Number.parseFloat(button.style.getPropertyValue('--selection')));
	expect(await selection()).toBe(8);
	const radius = await page.getByRole('button', { name: '3D controls', exact: true }).evaluate((button) => getComputedStyle(button).borderTopLeftRadius);
	await expect(detail(page)).toHaveCSS('border-top-left-radius', radius);
	await expect(fullscreen(page)).toHaveCSS('border-top-right-radius', radius);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45 }));
	expect(await selection()).toBeGreaterThan(0);
	expect(await selection()).toBeLessThan(8);
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'false');
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 1 }));
	expect(await selection()).toBe(0);
	await expect(fullscreen(page)).toHaveAttribute('aria-pressed', 'false');
	await detail(page).click();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeLessThan(0.001);
	await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
	await fullscreen(page).click();
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 1 }));
	await expect(fullscreen(page)).toHaveAttribute('aria-pressed', 'true');
	expect(await selection()).toBe(0);
	await detail(page).click();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeLessThan(0.001);
});

test('fullscreen minimap covers the whole fitted model and its viewport stays stable during orbit', async ({ page }, info) => {
	await page.goto('/demo/elements/torus-knot?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await fullscreen(page).click();
	await expectFullscreen(page);
	await page.mouse.move(900, 800);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const footprint = () => page.evaluate(() => window.__stageVisualTest!.getMinimapViewportRect()!);
	const fitted = await footprint();
	const panel = await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()!);
	const model = await page.evaluate(() => window.__stageVisualTest!.getMinimapModelRect()!);
	expect(fitted.x + panel.x).toBeLessThanOrEqual(model.x + 1);
	expect(fitted.y + panel.y).toBeLessThanOrEqual(model.y + 1);
	expect(fitted.x + fitted.width + panel.x).toBeGreaterThanOrEqual(model.x + model.width - 1);
	expect(fitted.y + fitted.height + panel.y).toBeGreaterThanOrEqual(model.y + model.height - 1);
	await page.screenshot({ path: info.outputPath('fullscreen-torus-fitted.png') });
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.35 }));
	const zoomed = await footprint();
	expect(zoomed.height).toBeLessThan(fitted.height);
	for (const azimuth of [45, 120, 210]) {
		await page.evaluate((azimuth) => window.__stageVisualTest!.setView({ zoom: 0.35, azimuth, polar: 20 }), azimuth);
		const rotated = await footprint();
		for (const key of ['x', 'y', 'width', 'height'] as const) expect(rotated[key]).toBeCloseTo(zoomed[key], 1);
	}
	await page.screenshot({ path: info.outputPath('fullscreen-torus-zoomed.png') });
});

for (const width of [1440, 375]) {
	test(`demo header and breadcrumb do not overlap at ${width}px`, async ({ page }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		const frame = page.locator('.demo-header');
		const header = await page.evaluate(() => window.__stageVisualTest!.getPanelRect(document.querySelector('.demo-header')!)!);
		const nav = page.getByRole('navigation', { name: 'Main navigation' });
		await expect(nav).toBeVisible();
		const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
		await expect(breadcrumb).toBeVisible();
		const crumb = (await breadcrumb.boundingBox())!;
		expect(crumb.y).toBeGreaterThanOrEqual(header.y + header.height + 5);
		for (const link of await nav.getByRole('link').all()) {
			const rect = (await link.boundingBox())!;
			expect(rect.y).toBeGreaterThanOrEqual(header.y);
			expect(rect.y + rect.height).toBeLessThanOrEqual(header.y + header.height);
			expect(rect.x).toBeGreaterThanOrEqual(header.x);
			expect(rect.x + rect.width).toBeLessThanOrEqual(header.x + header.width);
		}
		await expect(frame).toHaveCSS('height', width < 480 ? '88px' : '66px');
		await page.screenshot({ path: info.outputPath('demo-header.png') });
	});
}

for (const failure of ['missing', 'denied'] as const) {
	test(`fullscreen fallback with ${failure} API exits via Escape and restores scrolling`, async ({ page }) => {
		await page.addInitScript((failure) => {
			Object.defineProperty(Element.prototype, 'requestFullscreen', {
				configurable: true,
				value: failure === 'missing' ? undefined : () => Promise.reject(new Error('Fullscreen denied'))
			});
		}, failure);
		await open(page);
		await page.evaluate(() => window.scrollTo({ top: 100, behavior: 'instant' }));
		await expect.poll(() => page.evaluate(() => scrollY)).toBe(100);
		await fullscreen(page).click();
		await expectFullscreen(page);
		expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
		await page.mouse.move(20, 450);
		await page.mouse.wheel(0, 300);
		expect(await page.evaluate(() => scrollY)).toBe(100);
		if (failure === 'missing') {
			await page.getByRole('button', { name: '3D controls', exact: true }).click();
			await expect(page.locator('[data-spatial-element-help]')).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(page.locator('[data-spatial-element-help]')).not.toBeVisible();
			await expect(fullscreen(page)).toHaveAttribute('aria-pressed', 'true');
		}
		await page.keyboard.press('Escape');
		await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
		expect(await page.evaluate(() => scrollY)).toBe(100);
		await expect(page.locator('.stage-webgpu-background')).toHaveCSS('touch-action', 'manipulation');
		await page.mouse.wheel(0, 350);
		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
	});
}

test.describe('touch fullscreen', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });
	test('fallback rotates from empty background without scrolling and can return to detail', async ({ page }, info) => {
		await page.addInitScript(() => Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined, configurable: true }));
		await open(page);
		await fullscreen(page).tap();
		await expectFullscreen(page);
		await page.evaluate(() => window.__stageVisualTest!.settle(60));
		const map = await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()!);
		const help = (await page.getByRole('button', { name: '3D controls', exact: true }).boundingBox())!;
		expect(help.y).toBeGreaterThanOrEqual(map.y + map.height + 7);
		const cdp = await page.context().newCDPSession(page);
		const before = await orientation(page);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 8, y: 650, id: 1 }] });
		for (let step = 1; step <= 10; step++) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 8 + step * 5, y: 650 - step * 12, id: 1 }] });
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(async () => difference(before, await orientation(page))).toBeGreaterThan(0.02);
		expect(await page.evaluate(() => scrollY)).toBe(0);
		await page.screenshot({ path: info.outputPath('fullscreen-mobile.png') });
		await detail(page).tap();
		await expect(detail(page)).toHaveAttribute('aria-pressed', 'true');
	});
});
