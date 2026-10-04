import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const help = (page: Page) => page.locator('[data-spatial-element-help]');
const button = (page: Page) => page.getByRole('button', { name: '3D controls', exact: true });
const orientation = (page: Page) => page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!.live);
const difference = (a: number[], b: number[]) => Math.max(...a.map((n, i) => Math.abs(n - b[i])));

async function open(page: Page) {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(button(page)).toBeVisible();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getModelRect()?.width ?? 0)).toBeGreaterThan(0);
	await page.evaluate(() => window.__stageVisualTest!.settle(100));
	return page.evaluate(() => {
		const rect = window.__stageVisualTest!.getModelRect()!;
		return { x: rect.x + rect.width * 0.6, y: rect.y + rect.height * 0.5 };
	});
}

test('hover help repeats until interaction, delays hiding and supports persistent manual help', async ({ page }, info) => {
	const point = await open(page);
	const rect = (await button(page).boundingBox())!;
	expect(rect.width).toBeCloseTo(40, 0); expect(rect.height).toBeCloseTo(40, 0);
	const surface = await button(page).locator('xpath=ancestor::*[@data-stage-panel-css-surface]').boundingBox();
	expect(surface?.width).toBeCloseTo(40, 0); expect(surface?.height).toBeCloseTo(40, 0);
	expect(await button(page).innerText()).toBe('');
	await page.mouse.move(point.x, point.y);
	await page.waitForTimeout(200);
	await expect(help(page)).not.toBeVisible();
	await expect(help(page)).toBeVisible();
	await expect(help(page)).toContainText('Explore in 3D');
	await expect(help(page)).toContainText('Drag with the left mouse button');
	await expect(help(page).locator('.navigation-hint')).toHaveText('Alternatively, use a SpaceMouse to navigate.');
	const spaceMouse = help(page).getByRole('link', { name: 'SpaceMouse', exact: true });
	await expect(spaceMouse).toHaveAttribute('href', 'https://3dconnexion.com/');
	await expect(spaceMouse).toHaveAttribute('rel', 'noopener noreferrer');
	expect(await help(page).locator('dt').allTextContents()).toEqual(['Rotate', 'Zoom', 'Pan']);
	await expect(help(page).locator('svg[data-input="mouse"]')).toHaveCount(3);
	expect((await help(page).locator('dd').first().boundingBox())!.height).toBe(1);
	expect(await help(page).evaluate(node => node.contains(document.activeElement))).toBe(false);
	await page.mouse.move(1, 1); await page.waitForTimeout(100);
	await page.mouse.move(point.x, point.y); await page.waitForTimeout(400);
	await expect(help(page)).toBeVisible();
	const popup = (await help(page).boundingBox())!;
	expect(Math.abs(popup.x + popup.width - rect.x - rect.width)).toBeLessThan(5);
	await page.mouse.move(popup.x + 30, popup.y + 60);
	await expect(help(page)).toBeVisible();
	await page.screenshot({ path: info.outputPath('desktop-help.png') });
	await page.mouse.move(1, 1);
	await page.waitForTimeout(100);
	await expect(help(page)).toBeVisible();
	await expect(help(page)).not.toBeVisible();
	await page.mouse.move(point.x, point.y);
	await expect(help(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(help(page)).not.toBeVisible();
	await page.mouse.move(1, 1); await page.mouse.move(point.x, point.y);
	await expect(help(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await button(page).focus(); await page.keyboard.press('Enter');
	await expect(page.getByRole('button', { name: 'Close help' })).toBeFocused();
	await page.mouse.move(1, 1); await page.waitForTimeout(500);
	await expect(help(page)).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(button(page)).toBeFocused();
	await page.reload();
	await expect(button(page)).toBeVisible();
	await page.mouse.move(point.x, point.y);
	await expect(help(page)).toBeVisible();
});

test('preview settles, transfers its visible pose to dragging and stops after learning', async ({ page }) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	const point = await open(page);
	const before = await orientation(page);
	await page.mouse.move(point.x, point.y);
	await page.evaluate(() => window.__stageVisualTest!.settle(120));
	const preview = await orientation(page);
	expect(difference(before, preview)).toBeGreaterThan(0.001);
	expect(difference(before, preview)).toBeLessThan(0.06);
	// Opening the panel can finish an asynchronous quality/resize pass after the hover motion.
	await expect(help(page)).toBeVisible();
	await expect.poll(async () => {
		const passes = await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses);
		await page.waitForTimeout(400);
		return (await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses)) - passes;
	}).toBe(0);
	const idle = await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses);
	await page.waitForTimeout(350);
	expect(await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().stageModelRenderPasses)).toBe(idle);
	await page.mouse.down();
	expect(difference(preview, await orientation(page))).toBeLessThan(0.001);
	await page.mouse.move(point.x + 70, point.y + 25, { steps: 12 }); await page.mouse.up();
	await expect(help(page)).not.toBeVisible();
	await page.evaluate(() => window.__stageVisualTest!.settle(120));
	const learned = await orientation(page);
	await page.mouse.move(1, 1); await page.mouse.move(point.x, point.y);
	await page.evaluate(() => window.__stageVisualTest!.settle(120));
	expect(difference(learned, await orientation(page))).toBeLessThan(0.001);
	await page.goto('/demo/elements/torus-knot?stage-test=1');
	await expect(button(page)).toBeVisible();
	expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('spatial-elements:interaction-guidance:v1')!).interacted)).toBe(true);
	expect(errors).toEqual([]);
});

test('a quick wheel gesture skips the introduction and help remains usable in close-up', async ({ page }) => {
	const point = await open(page);
	await page.mouse.move(point.x, point.y); await page.mouse.wheel(0, -220);
	await page.waitForTimeout(850);
	await expect(help(page)).not.toBeVisible();
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.9 }));
	await expect(button(page)).toBeVisible();
	await button(page).click();
	await expect(help(page)).toBeVisible();
	expect(await help(page).evaluate(node => node.closest('[aria-hidden="true"]') !== null)).toBe(false);
});

test('reduced motion disables the introductory orbit', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const point = await open(page);
	const before = await orientation(page);
	await page.mouse.move(point.x, point.y);
	await page.evaluate(() => window.__stageVisualTest!.settle(120));
	expect(difference(before, await orientation(page))).toBeLessThan(0.00001);
});

test.describe('touch help', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });
	test('a small hint precedes interaction, the card stays in the viewport, and the first drag works', async ({ page }, info) => {
		const point = await open(page);
		await expect(page.locator('[data-spatial-element-touch-hint]')).toBeVisible();
		await expect(help(page)).not.toBeVisible();
		await button(page).tap();
		await expect(button(page)).not.toHaveAttribute('data-mouse-hover');
		await expect(help(page)).toContainText('Drag with one finger');
		await expect(help(page).locator('.navigation-hint')).toHaveText('Touch outside the model to scroll the page.');
		await expect(help(page).getByRole('link', { name: 'SpaceMouse' })).toHaveCount(0);
		await expect(help(page).locator('svg[data-input="touch"]')).toHaveCount(3);
		const rect = (await help(page).boundingBox())!;
		expect(rect.x).toBeGreaterThanOrEqual(15); expect(rect.x + rect.width).toBeLessThanOrEqual(415);
		expect(rect.y).toBeGreaterThanOrEqual(15); expect(rect.y + rect.height).toBeLessThanOrEqual(885);
		await page.screenshot({ path: info.outputPath('mobile-help.png') });
		await page.getByRole('button', { name: 'Close help' }).tap();
		const before = await orientation(page);
		const cdp = await page.context().newCDPSession(page);
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
		for (let i = 1; i <= 10; i++) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x + i * 5, y: point.y + i * 2, id: 1 }] });
			await page.waitForTimeout(20);
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(async () => difference(before, await orientation(page))).toBeGreaterThan(0.02);
		await expect(page.locator('[data-spatial-element-touch-hint]')).toHaveCount(0);
		await button(page).tap(); await expect(help(page)).toBeVisible();
		await page.reload(); await expect(button(page)).toBeVisible();
		await expect(page.locator('[data-spatial-element-touch-hint]')).toHaveCount(0);
	});
});
