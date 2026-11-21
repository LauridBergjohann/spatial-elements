import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('Page Sections palette reaches content, spatial surfaces and the footer in both modes', async ({ page }, info) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/docs/');
	for (const mode of ['Dark', 'Light']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		const colors = mode === 'Dark' ? {
			background: '#3b4047', 'section-standard': '#1f2126',
			'section-muted': '#23272e', ink: '#e5e5e6', body: '#fff',
			accent: '#219471', 'on-accent': '#1c1e22', border: 'hsl(219, 10%, 34%)',
			'footer-background': '#212126', 'footer-ink': '#aaaaaa',
			'footer-bar-background': '#262a30', 'footer-bar-ink': 'hsl(220, 5%, 65%)'
		} : {
			background: '#e7ebe9', 'section-standard': '#ffffff', 'section-muted': '#f2f2f2',
			ink: '#141414', body: '#666666', accent: '#007b5e', 'on-accent': '#ffffff', border: '#d1d1d1',
			'footer-background': '#007b5e', 'footer-ink': '#ffffff', 'footer-bar-background': '#bdbdbd', 'footer-bar-ink': '#333333'
		};
		const differences = await page.evaluate(colors => {
			const probe = document.createElement('span'); document.body.append(probe);
			const normalize = (color: string) => { probe.style.color = color; return getComputedStyle(probe).color; };
			const errors: string[] = [];
			for (const selector of ['.ps-shell', '.ps-navigation .header', '.site-footer']) {
				const style = getComputedStyle(document.querySelector(selector)!);
				for (const [name, expected] of Object.entries(colors)) {
					// The stage uses a transparent HTML background above its theme-colored canvas.
					if (name === 'background' && selector !== '.ps-shell') continue;
					const actual = normalize(style.getPropertyValue('--ps-' + name));
					if (actual !== normalize(expected)) errors.push(`${selector} ${name}: ${actual} != ${normalize(expected)}`);
				}
			}
			probe.remove(); return errors;
		}, colors);
		expect(differences).toEqual([]);
		await page.locator('.site-footer').scrollIntoViewIfNeeded();
		await page.screenshot({ path: info.outputPath(`page-sections-footer-${mode}.png`) });
		await page.evaluate(() => scrollTo(0, 0));
	}
});

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
			await expect(menu.getByRole('link', { name: 'Showcase', exact: true }).filter({ visible: true })).toHaveCSS('color', 'rgb(255, 255, 255)');
			const expectedAccent = mode === 'Dark' ? '#d5b975' : '#caa75c';
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
			await expect.poll(() => header.evaluate(node => getComputedStyle(node).getPropertyValue('--ps-accent').trim())).toBe(mode === 'Dark' ? '#219471' : '#007b5e');
		}
		expect(errors).toEqual([]);
	});
}

if (process.env.SPATIAL_GPU) test('Exclusive header glass and satellites follow every zoom frame', async ({ page }, info) => {
	await page.goto('/showcase/exclusive/chronograph/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	await expect.poll(() => page.evaluate(() => Boolean(window.__stageVisualTest))).toBe(true);
	const error = await page.evaluate(async () => {
		const api = window.__stageVisualTest!;
		const panels = [...document.querySelectorAll<HTMLElement>('[data-spatial-shell-menu], [data-spatial-shell-right]')];
		if (panels.length !== 2) throw new Error('Expected header and satellite');
		let maxError = 0;
		for (const step of [...Array.from({ length: 21 }, (_, i) => i), ...Array.from({ length: 21 }, (_, i) => 20 - i)]) {
			await api.setView({ zoom: step / 20 }, 1);
			for (const panel of panels) {
				const gpu = api.getPanelRect(panel), dom = panel.getBoundingClientRect();
				if (!gpu) {
					if (getComputedStyle(panel).visibility !== 'hidden') throw new Error(`Visible shell has no surface at zoom ${step / 20}`);
					continue;
				}
				for (const key of ['x', 'y', 'width', 'height'] as const) maxError = Math.max(maxError, Math.abs(dom[key] - gpu[key]));
			}
		}
		return maxError;
	});
	expect(error).toBeLessThan(0.6);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45 }));
	await page.screenshot({ path: info.outputPath('exclusive-header-zoom.png') });
});
