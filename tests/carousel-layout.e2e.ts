import { expect, test } from '@playwright/test';
import { resolveCarouselLayout } from '../packages/core/src/spatial-element/responsiveLayout';

for (const javaScriptEnabled of [false, true]) {
	test(`carousel native frame follows the resolver ${javaScriptEnabled ? 'with hydration' : 'without JavaScript'}`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 390, height: 900 } });
		try {
			const page = await context.newPage();
			if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/proof/carousel-layout');
			if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
			for (const width of [390, 600, 839, 840, 1200, 1600, 1809, 2300]) {
				await page.setViewportSize({ width, height: 900 });
				const actual = await page.evaluate(() => {
					const rect = (selector: string) => document.querySelector(selector)!.getBoundingClientRect().toJSON();
					return { section: rect('#layout-carousel'), fit: rect('.selected [data-carousel-fit-anchor]'), panel: rect('.selected .summary'), dots: rect('.controls'), outerOverflow: document.documentElement.scrollWidth > innerWidth };
				});
				const expected = resolveCarouselLayout({ width, height: 900, sectionTop: actual.section.y, hasHeadline: true, hasEyebrow: true });
				for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual.fit[key] - expected.mediaFit[key]), `${width} fit.${key}`).toBeLessThan(1.1);
				expect(Math.abs(actual.panel.x - expected.summary.x), `${width} panel.x`).toBeLessThan(1.1);
				expect(Math.abs(actual.panel.width - expected.summary.width), `${width} panel.width`).toBeLessThan(1.1);
				const panelTop = expected.summary.anchor.y - (expected.summary.anchor.alignment === 'center' ? actual.panel.height / 2 : 0);
				expect(Math.abs(actual.panel.y - panelTop), `${width} panel.y`).toBeLessThan(1.1);
				expect(Math.abs(actual.dots.y - expected.dots.y), `${width} dots.y`).toBeLessThan(1.1);
				expect(Math.abs(actual.section.height - expected.section.height), `${width} section.height`).toBeLessThan(1.1);
				expect(actual.outerOverflow).toBe(false);
			}
			await page.locator('.controls a').nth(2).click();
			await expect.poll(() => page.locator('.ring').evaluate(node => node.scrollLeft / node.clientWidth)).toBeCloseTo(2, 1);
		} finally { await context.close(); }
	});
}

test('compact panels reserve geometry height with optional eyebrow and omit unrestricted summary controls', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.setViewportSize({ width: 600, height: 900 });
	await page.goto('/proof/carousel-layout?custom=1&no-eyebrow=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const fit = await page.locator('.selected [data-carousel-fit-anchor]').boundingBox();
	await expect(page.locator('.selected .summary')).toHaveCSS('height', '40px');
	await expect(page.locator('.selected .full-summary')).toBeHidden();
	await page.locator('.controls a').nth(1).click();
	await expect(page.locator('[data-carousel-item="seat-1"] .summary')).toHaveCSS('height', '66px');
	const nextFit = await page.locator('[data-carousel-item="seat-1"] [data-carousel-fit-anchor]').boundingBox();
	expect(nextFit!.y).toBeCloseTo(fit!.y, 1);
	expect(nextFit!.height).toBe(fit!.height);
});

test('enhanced scene keeps its selected fit anchor and supports a bounded interactive custom summary', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/proof/carousel-layout?custom=1&long=1&stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const selected = page.locator('[data-carousel-item].selected');
	await expect(selected).toHaveAttribute('data-catalog-model-ready');
	await selected.getByLabel('Option for Column 1').fill('Retained selection');
	await selected.getByRole('button', { name: 'Add one Column 1' }).click();
	await expect(selected.locator('[data-carousel-custom-state]')).toHaveText('Retained selection: 2');
	expect(await selected.locator('[data-spatial-summary-root]').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
	await page.locator('.controls button').nth(1).click();
	await expect(page.locator('[data-carousel-item="seat-1"]')).toHaveClass(/selected/);
	await page.locator('.controls button').first().click();
	await expect(page.locator('[data-carousel-item="seat-0"]')).toHaveClass(/selected/);
	await expect(page.locator('[data-carousel-item="seat-0"] [data-carousel-custom-state]')).toHaveText('Retained selection: 2');
	await expect(page.locator('[data-carousel-item="seat-0"] .information')).toHaveAccessibleName('More information: Column 1');
	expect(errors).toEqual([]);
});

for (const count of [1, 2, 20]) {
	test(`${count} carousel entries retain unique presentation instances and native navigation`, async ({ page }) => {
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto(`/proof/carousel-layout?count=${count}&custom=1&no-headline=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(count);
		await expect(page.locator('.controls a')).toHaveCount(count === 1 ? 0 : count);
		const bounds = await page.locator('#layout-carousel').boundingBox();
		const expected = resolveCarouselLayout({ width: 1440, height: 900, hasHeadline: false, sectionTop: bounds!.y });
		expect(bounds!.height).toBeCloseTo(expected.section.height, 0);
	});
}
