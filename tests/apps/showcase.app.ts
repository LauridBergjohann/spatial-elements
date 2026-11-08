import { expect, test } from '@playwright/test';

test('two-state controls preserve the live shell, keyboard choice and reload preference', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	const shell = page.locator('.brand-stage-shell');
	await expect(shell).toHaveAttribute('data-color-scheme', 'dark');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', /enhanced|fallback|unsupported/, { timeout: 45_000 });
	const controls = page.locator('[data-spatial-shell-right]');
	await expect(controls.getByRole('button')).toHaveCount(2);
	await expect(controls.getByRole('button', { name: 'Dark mode' })).toHaveAttribute('aria-pressed', 'true');
	await page.screenshot({ path: info.outputPath('showcase-dark.png') });
	const original = await shell.elementHandle();
	await controls.getByRole('button', { name: 'Light mode' }).focus();
	await page.keyboard.press('Enter');
	await expect(shell).toHaveAttribute('data-color-scheme', 'light');
	expect(await original!.evaluate(node => node === document.querySelector('.brand-stage-shell'))).toBe(true);
	await page.screenshot({ path: info.outputPath('showcase-light.png') });
	await page.reload();
	await expect(shell).toHaveAttribute('data-color-scheme', 'light');
	await page.emulateMedia({ colorScheme: 'light' });
	await page.emulateMedia({ colorScheme: 'dark' });
	await expect(shell).toHaveAttribute('data-color-scheme', 'light');
	for (const width of [320, 600, 840, 1600]) {
		await page.setViewportSize({ width, height: 900 });
		if (width < 1600) await page.locator('.settings summary').click();
		const dark = page.getByRole('button', { name: 'Dark mode' }).filter({ visible: true });
		await expect(dark).toHaveCount(1);
		await dark.click();
		await expect(shell).toHaveAttribute('data-color-scheme', 'dark');
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	}
	await page.setViewportSize({ width: 320, height: 800 });
	await page.locator('.mobile-menu summary').click();
	await expect(page.locator('.mobile-menu').getByRole('link', { name: 'Documentation' })).toBeVisible();
	await page.screenshot({ path: info.outputPath('showcase-mobile.png') });
	expect(errors).toEqual([]);
});

test('theme selection remains usable when storage is blocked', async ({ page }) => {
	await page.addInitScript(() => {
		for (const method of ['getItem', 'setItem']) Object.defineProperty(Storage.prototype, method, { value: () => { throw new Error('Storage disabled'); } });
	});
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Dark mode' }).filter({ visible: true }).click();
	await expect(page.locator('.brand-stage-shell')).toHaveAttribute('data-color-scheme', 'dark');
});

test('the OS dark palette paints before hydration', async ({ page }) => {
	test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Production bundle bootstrap check');
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.route('**/_app/immutable/**', route => route.request().resourceType() === 'script' ? route.abort() : route.continue());
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme-pending', '');
	await expect(page.locator('.brand-stage-shell')).toHaveCSS('background-color', 'rgb(28, 30, 34)');
});

test('dark native page and mobile menu work without JavaScript', async ({ browser, baseURL }, info) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false, colorScheme: 'dark', viewport: { width: 320, height: 800 } });
	try {
		const page = await context.newPage();
		await page.goto('/');
		await expect(page.locator('.brand-stage-shell')).toHaveCSS('background-color', 'rgb(28, 30, 34)');
		await page.locator('.settings summary').click();
		await expect(page.getByRole('button', { name: 'Light mode' }).filter({ visible: true })).toBeDisabled();
		await page.locator('.mobile-menu summary').click();
		await expect(page.locator('.mobile-menu').getByRole('link', { name: 'Documentation' })).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.screenshot({ path: info.outputPath('showcase-no-js.png') });
	} finally { await context.close(); }
});
