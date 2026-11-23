import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
});

test('appearance and content menus share popup typography and queued scroll handling', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 900 });
	await page.goto('/docs/');
	const settings = page.locator('.settings > summary');
	await settings.click();
	const popup = page.locator('.settings-panel:popover-open');
	await expect(popup).toBeVisible();
	await expect(popup.getByRole('button', { name: 'Light', exact: true })).toContainText('Light');
	await expect(popup.getByRole('button', { name: 'Dark', exact: true })).toContainText('Dark');
	const title = popup.locator('.ps-popup-title');
	const typography = await title.evaluate(el => {
		const css = getComputedStyle(el);
		return { size: css.fontSize, weight: css.fontWeight };
	});
	await expect(popup.getByRole('heading', { name: 'Appearance' })).toHaveCSS('font-size', '14px');
	await expect(popup.getByRole('heading', { name: 'Appearance' })).toHaveCSS('font-weight', '500');
	await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
	await expect(popup).toBeVisible();
	await page.screenshot({ path: test.info().outputPath('settings.png') });
	await settings.click();
	await page.getByRole('button', { name: 'On this page', exact: true }).click();
	const contentTitle = page.locator('.ps-content-menu-slot .popup .ps-popup-title');
	await expect(contentTitle).toHaveCSS('font-size', typography.size);
	await expect(contentTitle).toHaveCSS('font-weight', typography.weight);
	await page.evaluate(() => scrollBy(0, 100));
	await expect(page.locator('[data-ps-popup-backdrop]')).toHaveCount(0);
});

test('shared shadow controls affect navigation, sections, panels and popups', async ({ page }) => {
	await page.goto('/showcase/consumer/logitech-brio-500/');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const header = page.locator('.website-header .header');
	const panel = page.locator('.spatial-element-panel > .stage-panel-surface');
	const shadow = () => panel.evaluate(el => getComputedStyle(el, '::before').boxShadow);
	const initialHeader = await header.evaluate(el => getComputedStyle(el).boxShadow);
	const initialPanel = await shadow();
	await page.addStyleTag({ content: '.brand-stage-shell { --ps-shadow-color: #ff0000; --ps-shadow-size: 2; --ps-shadow-intensity: 2; }' });
	await expect(header).not.toHaveCSS('box-shadow', initialHeader);
	await expect.poll(shadow).not.toBe(initialPanel);
	const changed = await shadow();
	await page.addStyleTag({ content: '.brand-stage-shell { --ps-shadow-intensity: 0; }' });
	await expect.poll(shadow).not.toBe(changed);
	// Complete replacements remain available separately from shared controls.
	await page.addStyleTag({ content: '.brand-stage-shell { --ps-panel-shadow: 0 0 3px rgb(0, 0, 255); --ps-navigation-shadow: 0 0 7px rgb(0, 255, 0); }' });
	await expect(header).toHaveCSS('box-shadow', 'rgb(0, 255, 0) 0px 0px 7px 0px');
	await expect.poll(shadow).toContain('rgb(0, 0, 255) 0px 0px 3px 0px');
	await page.goto('/docs/');
	await page.addStyleTag({ content: '.brand-stage-shell { --ps-popup-shadow: 0 0 9px rgb(255, 0, 0); --ps-surface-shadow: 0 0 5px rgb(0, 255, 0); }' });
	await expect(page.locator('.ps-section-surface').first()).toHaveCSS('box-shadow', 'rgb(0, 255, 0) 0px 0px 5px 0px');
	await page.locator('.desktop-menu').getByRole('link', { name: 'Documentation', exact: true }).hover();
	await expect(page.locator('.ps-submenu:popover-open')).toHaveCSS('box-shadow', 'rgb(255, 0, 0) 0px 0px 9px 0px');
});
