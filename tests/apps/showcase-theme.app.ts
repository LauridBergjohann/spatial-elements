import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	test(`Exclusive scopes the Watches theme and preserves navigation (enhanced: ${enhanced})`, async ({ page }, info) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/showcase/');
		const header = page.locator('.ps-navigation [data-spatial-shell-menu]');
		const menu = page.locator('.ps-navigation');
		for (const mode of ['Dark', 'Light']) {
			await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
			await page.locator('#areas').getByRole('link', { name: 'Exclusive', exact: true }).click();
			await expect(page).toHaveURL(/\/showcase\/exclusive\/$/);
			if (enhanced) {
				await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
				await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
			}
			await expect(header).toHaveCSS('border-radius', '22px');
			const expectedAccent = mode === 'Dark' ? '#caa75c' : '#806020';
			await expect.poll(() => header.evaluate(node => getComputedStyle(node).getPropertyValue('--ps-accent').trim())).toBe(expectedAccent);
			await expect(page.locator('[data-spatial-navigation-glass]')).toHaveCount(1);
			await expect(menu.getByRole('link', { name: 'Documentation', exact: true }).filter({ visible: true })).toBeVisible();
			await page.screenshot({ path: info.outputPath(`exclusive-collection-${mode}.png`) });
			await page.locator('#collection').getByRole('link', { name: 'Chronograph', exact: true }).click();
			await expect(page).toHaveURL(/\/showcase\/exclusive\/chronograph\/$/);
			if (enhanced) {
				await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
				await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
				await expect(page.locator('[data-stage-panel-bound][data-stage-panel-surface="glass"]').first()).toBeAttached();
			}
			await expect(header).toHaveCSS('border-radius', '22px');
			await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).filter({ visible: true }).first().getByRole('link', { name: 'Exclusive', exact: true })).toHaveAttribute('href', '/showcase/exclusive/');
			await page.screenshot({ path: info.outputPath(`exclusive-${mode}.png`) });
			await menu.getByRole('link', { name: 'Showcase', exact: true }).filter({ visible: true }).click();
			await expect(page).toHaveURL(/\/showcase\/$/);
			if (enhanced) await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
			await expect(header).toHaveCSS('border-radius', '12px');
			await expect(page.locator('[data-spatial-navigation-glass]')).toHaveCount(0);
			await expect.poll(() => header.evaluate(node => getComputedStyle(node).getPropertyValue('--ps-accent').trim())).toBe(mode === 'Dark' ? '#09a782' : '#007b5e');
		}
		expect(errors).toEqual([]);
	});
}
