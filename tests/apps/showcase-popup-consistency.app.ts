import { expect, test, type Locator } from '@playwright/test';

const route = '/docs/foundations/page-sections/';
const blur = (page: import('@playwright/test').Page) =>
	page.locator('[data-ps-popup-backdrop]:popover-open');
async function topmost(target: Locator) {
	await expect
		.poll(() =>
			target.evaluate((node) => {
				const r = node.getBoundingClientRect();
				const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
				return hit === node || node.contains(hit);
			})
		)
		.toBe(true);
}

for (const width of [390, 1250, 1700])
	test(`popup lifecycle and active triggers at ${width}px`, async ({ page }, info) => {
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width, height: 900 });
		await page.goto(route);
		await expect(page.locator('.mobile-search')).toBeAttached();
		const outside = () => page.mouse.click(5, 850);
		for (const kind of width < 1200
			? ['mobile-menu', 'settings']
			: width < 1600
				? ['settings']
				: []) {
			const trigger = page.locator(`.${kind} > summary`);
			const initialColor = await trigger.evaluate((node) => getComputedStyle(node).color);
			for (const dismissal of ['outside', 'toggle', 'escape', 'outside']) {
				await trigger.click();
				await expect(blur(page)).toHaveCount(1);
				await expect(blur(page)).toHaveCSS('backdrop-filter', 'blur(3px)');
				await expect(trigger).not.toHaveCSS('color', initialColor);
				await topmost(trigger);
				await expect(page.locator(`.${kind} > :popover-open`)).toBeVisible();
				if (dismissal === 'toggle') await trigger.click();
				else if (dismissal === 'escape') await page.keyboard.press('Escape');
				else await outside();
				await expect(blur(page)).toHaveCount(0);
				await expect(trigger).toHaveCSS('color', initialColor);
			}
		}
		const search = page.getByRole('button', { name: 'Open search', exact: true });
		const input = page.getByRole('combobox', { name: 'Search documentation' });
		const compact = width < 800 || (width >= 1200 && width < 1600);
		for (const dismissal of compact ? ['toggle', 'outside', 'escape'] : ['outside', 'escape']) {
			if (compact) await search.click();
			else await input.click();
			await input.fill('theme');
			await expect(blur(page)).toHaveCount(1);
			await topmost(input);
			await topmost(page.getByRole('option').first());
			if (compact) {
				await expect(search).toHaveAttribute('aria-expanded', 'true');
				await expect(page.locator('.search-surface:popover-open')).toBeVisible();
				await expect(page.locator('.search-panel:popover-open')).toHaveCount(0);
			}
			await page.screenshot({ path: info.outputPath(`search-${dismissal}.png`) });
			if (dismissal === 'toggle') await search.click();
			else if (dismissal === 'escape') await input.press('Escape');
			else await outside();
			await expect(blur(page)).toHaveCount(0);
			if (compact) await expect(search).toHaveAttribute('aria-expanded', 'false');
		}
		if (width < 1600) {
			// Switching popup owners must leave one backdrop and reset the previous trigger.
			await search.click();
			const settings = page.locator('.settings > summary');
			await settings.click();
			await expect(search).toHaveAttribute('aria-expanded', 'false');
			await expect(page.locator('.settings[open]')).toHaveCount(1);
			await expect(blur(page)).toHaveCount(1);
			await page.keyboard.press('Escape');
			await expect(blur(page)).toHaveCount(0);
		}
		if (width < 1600) {
			const content = page.getByRole('button', { name: 'On this page', exact: true });
			await content.click();
			await expect(blur(page)).toHaveCount(1);
			await topmost(content);
			await topmost(page.locator('.ps-content-menu-slot .popup a').first());
			await outside();
			await expect(blur(page)).toHaveCount(0);
		} else {
			const docs = page
				.locator('.desktop-menu')
				.getByRole('link', { name: 'Documentation', exact: true });
			await docs.hover();
			await expect(blur(page)).toHaveCount(1);
			const option = page.locator('.ps-submenu:popover-open a').first();
			await option.hover();
			await topmost(option);
			await expect(docs).toHaveAttribute('aria-expanded', 'true');
			await page.keyboard.press('Escape');
			await expect(blur(page)).toHaveCount(0);
		}
	});

test('dark theme popup follows tab and accent colors', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	await page.goto(route);
	await page.setViewportSize({ width: 390, height: 900 });
	await page.locator('.settings > summary').click();
	const dark = page.locator('.settings-panel').getByRole('button', { name: 'Dark', exact: true });
	await dark.click();
	await expect(dark).toHaveAttribute('aria-pressed', 'true');
	await page.keyboard.press('Escape');
	const search = page.getByRole('button', { name: 'Open search', exact: true });
	await search.click();
	const expected = await search.evaluate((node) => {
		const sample = document.createElement('span');
		sample.style.cssText = 'color:var(--ps-accent);background:var(--ps-selection)';
		node.append(sample);
		const css = getComputedStyle(sample);
		const result = { color: css.color, background: css.backgroundColor };
		sample.remove();
		return result;
	});
	await expect(search).toHaveCSS('color', expected.color);
	await expect(search).toHaveCSS('background-color', expected.background);
	await expect(blur(page)).toHaveCSS('transition-duration', '0s');
	await page.screenshot({ path: test.info().outputPath('search-dark.png') });
	await search.click();
	await expect(blur(page)).toHaveCount(0);
});

test('header stays on one line across search and navigation breakpoints', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto(route);
	await expect(page.locator('.mobile-search')).toBeAttached();
	for (const width of [
		320, 390, 600, 800, 1199, 1200, 1250, 1399, 1400, 1599, 1600, 1700, 1920, 2456
	]) {
		await page.setViewportSize({ width, height: 900 });
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
		if (width < 1200) continue;
		const rects = await page
			.locator('.desktop-menu .ps-main-menu > li > a')
			.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
		expect(new Set(rects.map((rect) => Math.round(rect.y))).size).toBe(1);
		const tools = (await page.locator('.ps-navigation .tools').boundingBox())!;
		expect(Math.max(...rects.map((rect) => rect.right))).toBeLessThanOrEqual(tools.x);
	}
});
