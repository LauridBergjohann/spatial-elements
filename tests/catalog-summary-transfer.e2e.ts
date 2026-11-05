import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const width of [840, 1440, 1809, 2456]) for (const reducedMotion of width === 1440 ? ['no-preference', 'reduce'] as const : ['no-preference'] as const) {
	test(`ordinary ${width}px carousel round trip retains its live summary (${reducedMotion})`, async ({ page }) => {
		await page.setViewportSize({ width, height: 1100 });
		await page.emulateMedia({ reducedMotion });
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.goto('/staged/categories/carousel?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const selected = page.locator('[data-carousel-item="column"]');
		await expect(selected).toHaveAttribute('data-catalog-model-ready');
		const note = selected.getByLabel('Configuration note');
		await note.fill('Retained forward configuration');
		const original = await note.elementHandle();
		// Hero navigation uses the ordinary path, explicitly without stagedNavigation.
		await selected.locator('a.information').evaluate((node: HTMLAnchorElement) => {
			node.href = node.href.split('#')[0]; node.dataset.catalogView = JSON.stringify({ spatialElementId: 'column', targetPresentation: 'hero' });
		});
		await selected.locator('a.information').click();
		await expect(page).toHaveURL(/\/staged\/elements\/column/);
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		await expect(page.getByLabel('Configuration note')).toHaveValue('Retained forward configuration');
		expect(await original!.evaluate(node => node === document.querySelector('textarea'))).toBe(true);
		await page.getByLabel('Configuration note').fill('Retained back configuration');
		await expect(page.locator('[data-retained-note]')).toHaveText('Retained back configuration');
		await page.goBack();
		await expect(page).toHaveURL(/\/staged\/categories\/carousel/);
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		await expect(selected.getByLabel('Configuration note')).toHaveValue('Retained back configuration');
		expect(await original!.evaluate(node => node === document.querySelector('[data-carousel-item="column"] textarea'))).toBe(true);
		// The bridge resolves the history focus key after onRestored has adopted
		// the real root and completed motion, so it must focus the surviving link.
		await expect(selected.locator('a.information')).toBeFocused();
		await selected.getByLabel('Configuration note').fill('Bindings remain active');
		await expect(selected.locator('[data-retained-note]')).toHaveText('Bindings remain active');
		await expect(page.locator('[data-spatial-summary-transfer]')).toHaveCount(0);
		expect(errors).toEqual([]);
	});
}
