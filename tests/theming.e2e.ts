import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const theme = (page: Page) => page.locator('.brand-stage-shell');
async function open(page: Page) {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(page.getByRole('button', { name: 'System appearance', exact: true })).toBeVisible();
	await page.evaluate(() => window.__stageVisualTest!.settle(50));
}

test('shell preference follows the OS, supports keyboard selection and persists across navigation and reload', async ({
	page
}, info) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.emulateMedia({ colorScheme: 'dark' });
	await open(page);
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'dark');
	await expect(
		page.getByRole('button', { name: 'System appearance', exact: true })
	).toHaveAttribute('aria-pressed', 'true');
	await page.screenshot({ path: info.outputPath('demo-dark.png') });
	await page.getByRole('button', { name: 'Light mode', exact: true }).focus();
	await page.keyboard.press('Enter');
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await page.emulateMedia({ colorScheme: 'light' });
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await page.reload();
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await page.getByRole('link', { name: 'List', exact: true }).click();
	await expect(page).toHaveURL(/categories\/list/);
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await page.getByRole('button', { name: 'System appearance', exact: true }).click();
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'dark');
	expect(await page.evaluate(() => sessionStorage.getItem('spatial-demo-appearance'))).toBeNull();
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	expect(errors).toEqual([]);
});

test('live palettes preserve camera, resources, minimap and fullscreen', async ({ page }, info) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await open(page);
	const loads: string[] = [];
	page.on('request', (request) => {
		if (/\.(glb|hdr)(\?|$)/.test(request.url())) loads.push(request.url());
	});
	await page.evaluate(() =>
		window.__stageVisualTest!.setView({ zoom: 0.7, azimuth: 33, polar: 12 })
	);
	const before = await page.evaluate(() => ({
		orientation: window.__stageVisualTest!.getMinimapOrientation()!.live,
		model: window.__stageVisualTest!.getModelRect(),
		focus: window.__stageVisualTest!.getState().focus,
		resources: window.__stageVisualTest!.getRenderTargetStats()
	}));
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'dark');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const after = await page.evaluate(() => ({
		orientation: window.__stageVisualTest!.getMinimapOrientation()!.live,
		model: window.__stageVisualTest!.getModelRect(),
		focus: window.__stageVisualTest!.getState().focus,
		resources: window.__stageVisualTest!.getRenderTargetStats()
	}));
	expect(after.orientation).toEqual(before.orientation);
	expect(after.model).toEqual(before.model);
	expect(after.focus).toBe(before.focus);
	expect(after.resources.creations).toBe(before.resources.creations);
	await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	await page.emulateMedia({ colorScheme: 'light' });
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	await expect(page.getByRole('button', { name: 'Fullscreen', exact: true })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: '3D controls', exact: true }).click();
	await expect(page.locator('[data-spatial-element-help]')).toBeVisible();
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'dark');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	await expect(page.locator('[data-spatial-element-help]')).toBeVisible();
	await page.getByRole('button', { name: 'Close help', exact: true }).click();
	await page.screenshot({ path: info.outputPath('fullscreen-dark.png') });
	await page.getByRole('button', { name: 'Detail view', exact: true }).click();
	await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Dark mode', exact: true })).toHaveCSS(
		'color',
		'rgb(237, 244, 252)'
	);
	expect(loads).toEqual([]);
});

test('the initial dark palette is present before hydration, and blocked storage remains usable', async ({
	browser
}) => {
	const context = await browser.newContext({ colorScheme: 'dark' });
	const page = await context.newPage();
	await page.route('**/_app/immutable/**', (route) =>
		route.request().resourceType() === 'script' ? route.abort() : route.continue()
	);
	await page.goto('/demo/elements/cube');
	await expect(theme(page)).toHaveCSS('background-color', 'rgb(18, 25, 35)');
	await expect(page.locator('html')).toHaveAttribute('data-theme-pending', '');
	await page.unroute('**/_app/immutable/**');
	await page.addInitScript(() => {
		for (const method of ['getItem', 'setItem', 'removeItem'])
			Object.defineProperty(Storage.prototype, method, {
				value: () => {
					throw new Error('Storage disabled');
				}
			});
	});
	await open(page);
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'dark');
	await page.getByRole('button', { name: 'Light mode', exact: true }).click();
	await expect(theme(page)).toHaveAttribute('data-color-scheme', 'light');
	await context.close();
});
