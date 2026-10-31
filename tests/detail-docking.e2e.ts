import { expect, test } from '@playwright/test';
import { resolveSpatialElementDockLayout } from '../packages/core/src/spatial-element/spatialElementDock';
import { STAGE_PANEL_LAYOUT_EVENT } from '../packages/core/src/stage/panelContext';

test('native submenu starts at M with an accessible overview icon and real section links', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 840, height: 900 } });
	try {
		const page = await context.newPage();
		await page.goto('/demo/layout-docking');
		const list = page.locator('[data-spatial-element-tab-list]');
		await expect(list).toHaveCount(1);
		await expect(list.locator('[data-spatial-element-tab-id="overview"] svg')).toBeVisible();
		await expect(list.getByRole('link', { name: 'Übersicht', exact: true })).toHaveAttribute('href', '#overview');
		await expect(list).toHaveCSS('height', '40px');
		await expect(list.locator('a')).toHaveCount(9);
		await page.setViewportSize({ width: 839, height: 900 });
		await expect(list).toBeHidden();
	} finally { await context.close(); }
});

test('dock geometry follows the common layout and native scrolling once', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-docking');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const header = page.locator('[data-spatial-element-sticky-header]');
	for (const width of [430, 600, 840, 1200, 1600, 1809, 2100]) {
		await page.setViewportSize({ width, height: 900 });
		await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
		await expect(header).toHaveAttribute('data-active', '');
		const scrollbarWidth = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
		const expected = resolveSpatialElementDockLayout({ width, height: 900, scrollbarWidth }, 10000)!;
		await expect.poll(async () => {
			const bounds = (await header.boundingBox())!;
			return Math.max(Math.abs(bounds.x - expected.header.left), Math.abs(bounds.y - expected.header.top),
				Math.abs(bounds.width - expected.header.width), Math.abs(bounds.height - expected.header.height));
		}).toBeLessThan(0.5);
		const actual = (await header.boundingBox())!;
		expect(actual.x).toBeCloseTo(expected.header.left, 0);
		expect(actual.width).toBeCloseTo(expected.header.width, 0);
		expect(actual.height).toBe(expected.header.height);
		await expect(header.getByRole('link', { name: 'Open the final section' })).toBeVisible();
		await expect(page.locator('[data-spatial-element-hero-panel-content] [data-catalog-rich-shared="primary-action"]')).toHaveAttribute('inert', '');
		const tabs = page.locator('[data-spatial-element-sticky-tabs]');
		if (expected.submenu) {
			await expect(tabs).toHaveAttribute('data-active', '');
			const bounds = (await tabs.boundingBox())!;
			expect(bounds.y).toBeCloseTo(expected.submenu.top, 0);
			expect(bounds.height).toBe(expected.submenu.height);
		} else await expect(tabs).toBeHidden();
	}
});

for (const gpu of [false, true]) {
	test(`docking preserves the live submenu and focus with ${gpu ? 'WebGPU' : 'native fallback'}`, async ({ page }) => {
		if (!gpu) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width: 1000, height: 900 });
		await page.goto('/demo/layout-docking?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', gpu ? 'enhanced' : 'fallback');
		await expect(page.locator('[data-spatial-element-tabs-measured]')).toHaveCount(1);
		const sourceBounds = (await page.locator('[data-spatial-element-tab-list]').boundingBox())!;
		await page.evaluate(() => {
			const list = document.querySelector<HTMLElement>('[data-spatial-element-tab-list]')!;
			const link = list.querySelector<HTMLElement>('[data-spatial-element-tab-id="docking-section-4"]')!;
			(window as any).__dockIdentity = { list, link };
			link.focus({ preventScroll: true });
		});
		await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'instant' }));
		await expect(page.locator('[data-spatial-element-sticky-tabs]')).toHaveAttribute('data-active', '');
		expect(await page.evaluate(() => {
			const saved = (window as any).__dockIdentity;
			return saved.list === document.querySelector('[data-spatial-element-tab-list]') && saved.link === document.activeElement;
		})).toBe(true);
		await expect(page.locator('[data-spatial-element-tab-list]')).toHaveCount(1);
		const dockedBounds = (await page.locator('[data-spatial-element-tab-list]').boundingBox())!;
		expect(dockedBounds.x).toBeCloseTo(sourceBounds.x, 0);
		expect(dockedBounds.width).toBeCloseTo(sourceBounds.width, 0);
		expect(dockedBounds.y).toBeCloseTo(80, 0);
		// An internally emitted layout notification must not start an endless
		// measure/re-dock loop once the scroll and its observers have settled.
		const layoutEvents = await page.evaluate(async eventName => {
			await new Promise<void>(resolve => { let frames = 8; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); });
			let count = 0;
			const countEvent = () => count++;
			window.addEventListener(eventName, countEvent);
			await new Promise<void>(resolve => { let frames = 12; const next = () => --frames ? requestAnimationFrame(next) : resolve(); requestAnimationFrame(next); });
			window.removeEventListener(eventName, countEvent);
			return count;
		}, STAGE_PANEL_LAYOUT_EVENT);
		expect(layoutEvents).toBeLessThan(3);
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
		await expect(page.locator('[data-spatial-element-tab-list]')).toHaveAttribute('data-spatial-element-tab-list', 'panel');
		expect(await page.evaluate(() => (window as any).__dockIdentity.link === document.activeElement)).toBe(true);
	});
}

test('direct hashes and long-label keyboard navigation leave the section below the dock', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.setViewportSize({ width: 900, height: 900 });
	await page.goto('/demo/layout-docking#docking-section-4');
	const header = page.locator('[data-spatial-element-sticky-header]');
	await expect(header).toHaveAttribute('data-active', '');
	const list = page.locator('[data-spatial-element-tab-list]');
	const last = list.locator('[data-spatial-element-tab-id="docking-section-8"]');
	await last.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/#docking-section-8$/);
	await expect(last).toHaveAttribute('aria-current', 'location');
	await expect.poll(async () => (await page.locator('#docking-section-8').boundingBox())!.y).toBeGreaterThanOrEqual(120);
	const rects = await last.evaluate(element => ({ link: element.getBoundingClientRect().toJSON(),
		container: element.closest('[data-spatial-element-tab-links]')!.getBoundingClientRect().toJSON() }));
	await expect.poll(async () => last.evaluate(element => {
		const link = element.getBoundingClientRect(), parent = element.parentElement!.getBoundingClientRect();
		return link.right <= parent.right + 1 && link.left >= parent.left - 1;
	})).toBe(true);
	expect(rects.link.width).toBeGreaterThan(0);
	await page.goBack();
	await expect(page).toHaveURL(/#docking-section-4$/);
	await expect.poll(async () => (await page.locator('#docking-section-4').boundingBox())!.y).toBeGreaterThanOrEqual(120);
});
