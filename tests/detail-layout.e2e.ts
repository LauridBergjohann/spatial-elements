import { expect, test } from '@playwright/test';
import { resolveDetailLayout } from '../packages/core/src/spatial-element/responsiveLayout';

for (const javaScriptEnabled of [false, true]) {
	test(`detail frames follow shared resolver ${javaScriptEnabled ? 'with hydration' : 'before JavaScript'}`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 390, height: 900 } });
		try {
			const page = await context.newPage();
			if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/proof/detail-layout/default');
			if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
			for (const width of [390, 600, 840, 1200, 1600, 1809, 1940]) {
				await page.setViewportSize({ width, height: 900 });
				const expected = resolveDetailLayout({ width, height: 900 });
				const actual = await page.evaluate(() => {
					const rect = (selector: string) => { const r = document.querySelector(selector)!.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
					return { fit: rect('.spatial-element-visual'), rail: rect('.spatial-element-rail'), summary: rect('.spatial-element-aside'), body: rect('.spatial-element-section-list'), rootCount: document.querySelectorAll('[data-spatial-summary-root]').length, overflow: document.documentElement.scrollWidth > window.innerWidth };
				});
				for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual.fit[key] - expected.mediaFit[key]), `${width}px fit.${key}`).toBeLessThan(1.1);
				for (const key of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(actual.rail[key] - expected.rail.rect[key]), `${width}px rail.${key}`).toBeLessThan(1.1);
				expect(Math.abs(actual.summary.x - expected.summary.x), `${width}px summary.x`).toBeLessThan(1.1);
				expect(Math.abs(actual.summary.width - expected.summary.width), `${width}px summary.width`).toBeLessThan(1.1);
				expect(Math.abs(actual.summary.y - expected.summary.anchor.y), `${width}px summary.y`).toBeLessThan(1.1);
				expect(actual.summary.height).toBeGreaterThan(0);
				if ('maxHeight' in expected.summary.height) expect(actual.summary.height).toBeLessThanOrEqual(expected.summary.height.maxHeight! + 1);
				expect(actual.body.y).toBeGreaterThanOrEqual(actual.summary.y + actual.summary.height - 1);
				expect(actual.rootCount).toBe(1);
				expect(actual.overflow).toBe(false);
			}
		} finally { await context.close(); }
	});
}

test('custom summary is intrinsic on compact layouts and bounded with interactive content on wide layouts', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/proof/detail-layout/long');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	await page.getByLabel('Inscription').fill('Custom state');
	await page.getByRole('button', { name: 'Add quantity' }).click();
	await expect(page.locator('[data-detail-reactive]')).toHaveText('Custom state, quantity 2');
	const root = page.locator('[data-spatial-summary-root]');
	expect(await root.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
	await page.setViewportSize({ width: 390, height: 900 });
	await expect.poll(() => root.evaluate(node => node.scrollHeight <= node.clientHeight + 1)).toBe(true);
	await page.getByLabel('Inscription').fill('Still live after resize');
	await expect(page.locator('[data-detail-reactive]')).toContainText('Still live after resize');
	expect(errors).toEqual([]);
});

test('short summary without a CTA stays intrinsic rather than reserving a fixed panel height', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/proof/detail-layout/short');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const panel = await page.locator('.spatial-element-panel').boundingBox();
	expect(panel!.height).toBeGreaterThan(80);
	expect(panel!.height).toBeLessThan(300);
	await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
});

test('WebGPU projection retains the live custom-summary event root and bounded content', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/proof/detail-layout/long');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
	await page.getByLabel('Inscription').fill('Projected input');
	await page.getByRole('button', { name: 'Add quantity' }).click();
	await expect(page.locator('[data-detail-reactive]')).toHaveText('Projected input, quantity 2');
	expect(await page.locator('[data-spatial-summary-root]').evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
	expect(errors).toEqual([]);
});
