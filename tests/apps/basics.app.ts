import { expect, test } from '@playwright/test';

for (const javaScriptEnabled of [true, false]) {
	test(`Basics stays light and navigable with JavaScript ${javaScriptEnabled}`, async ({ browser, baseURL }, info) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, colorScheme: 'dark', viewport: { width: 600, height: 900 } });
		try {
			await context.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			const page = await context.newPage();
			await page.goto('/');
			await expect(page).toHaveURL(/\/demo\/categories\/list$/);
			if (javaScriptEnabled) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', /fallback|unsupported/);
			await expect(page.locator('.brand-stage-shell')).toHaveCSS('color-scheme', 'light');
			await expect(page.getByRole('group', { name: 'Appearance' })).toHaveCount(0);
			await expect(page.getByRole('button', { name: 'Appearance', exact: true })).toHaveCount(0);
			await expect(page.getByRole('link', { name: 'Spatial Elements Basics', exact: true })).toContainText('Basics');
			await page.locator('.mobile-menu summary').click();
			await page.getByRole('link', { name: 'Carousel', exact: true }).filter({ visible: true }).click();
			await expect(page).toHaveURL(/categories\/carousel$/);
			await expect(page.locator('.brand-stage-shell')).toHaveCSS('color-scheme', 'light');
			await page.setViewportSize({ width: 320, height: 800 });
			await page.locator('.mobile-menu summary').click();
			await page.locator('.mobile-menu').getByRole('link', { name: 'List', exact: true }).click();
			await expect(page).toHaveURL(/categories\/list$/);
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ path: info.outputPath('basics-mobile.png') });
		} finally { await context.close(); }
	});
}
