import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const routes = [
	{ path: '/demo/categories/list', anchors: ['.header-row', 'main', '#catalog-title', '.catalog', '[data-catalog-card]'] },
	{ path: '/demo/categories/carousel', anchors: ['.header-row', 'main', '#catalog-title', '[data-carousel-section]', '.ring', '[data-carousel-item="column"] .summary'] },
	{ path: '/demo/elements/column', anchors: ['.header-row', 'main', '.spatial-element-hero', '[data-stage-viewport]', '.spatial-element-aside', '#spatial-element-title', '.spatial-element-tabs-anchor'] },
	{ path: '/starter/categories/list', anchors: ['main', '#catalog-title', '.catalog', '[data-catalog-card]'] }
];

async function rectangles(page: Page, selectors: string[]) {
	return page.evaluate((selectors) => selectors.map((selector) => {
		const element = document.querySelector(selector);
		if (!element) throw new Error(`Missing layout anchor ${selector}`);
		const { x, y, width, height } = element.getBoundingClientRect();
		return { selector, x, y, width, height };
	}), selectors);
}

for (const width of [1440, 430]) for (const { path, anchors } of routes) {
	test(`SSR geometry survives GPU enhancement: ${path} at ${width}px`, async ({ page }, info) => {
		// A production build delivers CSS independently of JavaScript. Vite's development
		// module styles cannot represent the server-only paint when scripts are held.
		test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Requires production CSS for the SSR paint');
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(() => {
			const shifts: number[] = [];
			Object.assign(window, { enhancementShifts: shifts });
			new PerformanceObserver(list => {
				for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[])
					if (!entry.hadRecentInput) shifts.push(entry.value);
			}).observe({ type: 'layout-shift', buffered: true });
		});
		let releaseScripts!: () => void;
		const scripts = new Promise<void>((resolve) => { releaseScripts = resolve; });
		await page.route('**/*', async (route) => {
			if (route.request().resourceType() === 'script') await scripts;
			await route.continue();
		});
		try {
			await page.goto(`${path}?stage-test=1`, { waitUntil: 'commit' });
			await expect(page.locator(anchors.at(-1)!).first()).toBeVisible();
			await page.evaluate(() => document.fonts.ready);
			const initial = await rectangles(page, anchors);
			await page.screenshot({ path: info.outputPath('server-html.png') });
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'loading');
			await expect(page.locator('.stage-status')).toHaveCount(0);
			releaseScripts();
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
			await page.evaluate(() => window.__stageVisualTest?.settle(24));
			const enhanced = await rectangles(page, anchors);
			await page.screenshot({ path: info.outputPath('enhanced.png') });
			for (const [index, before] of initial.entries()) {
				for (const property of ['x', 'y', 'width', 'height'] as const) {
					expect(Math.abs(enhanced[index][property] - before[property]), `${before.selector}: ${property}`).toBeLessThanOrEqual(1);
				}
			}
			expect(await page.evaluate(() => (window as unknown as { enhancementShifts: number[] }).enhancementShifts.reduce((sum, value) => sum + value, 0))).toBeLessThan(0.02);
		} finally {
			releaseScripts();
		}
	});
}

test('system dark appearance and document metrics are usable without JavaScript', async ({ browser, baseURL }) => {
	test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Requires production CSS for the SSR paint');
	const contexts = await Promise.all([false, true].map((javaScriptEnabled) =>
		browser.newContext({ baseURL, javaScriptEnabled, colorScheme: 'dark', viewport: { width: 1440, height: 900 } })
	));
	try {
		const appearances = [];
		for (const [index, context] of contexts.entries()) {
			const page = await context.newPage();
			if (index === 1) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/demo/categories/list');
			if (index === 1) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
			await expect(page.locator('.stage-status')).toHaveCount(0);
			appearances.push(await page.evaluate(() => ({
				background: getComputedStyle(document.querySelector('.stage')!).backgroundColor,
				ink: getComputedStyle(document.querySelector('#catalog-title')!).color,
				margin: getComputedStyle(document.body).margin,
				colorScheme: getComputedStyle(document.querySelector('.brand-stage-shell')!).colorScheme
			})));
		}
		expect(appearances[0]).toEqual(appearances[1]);
		expect(appearances[0]).toMatchObject({ margin: '0px', colorScheme: 'dark' });
	} finally {
		await Promise.all(contexts.map((context) => context.close()));
	}
});
