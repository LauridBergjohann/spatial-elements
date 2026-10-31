import { expect, test } from '@playwright/test';
import { resolveMenuOffset, resolveResponsiveLayout } from '../packages/core/src/spatial-element/responsiveLayout';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const javaScriptEnabled of [false, true]) {
	test(`navigation owns its boxes and bounded scrolling ${javaScriptEnabled ? 'after hydration' : 'without JavaScript'}`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({ baseURL, javaScriptEnabled, viewport: { width: 1700, height: 800 } });
		try {
			const page = await context.newPage();
			if (javaScriptEnabled) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.goto('/demo/layout-cards');
			const menu = page.locator('.spatial-shell-menu');
			const satellite = page.locator('.spatial-shell-right');
			for (const width of [320, 600, 840, 1200, 1599, 1600, 1809, 2300]) {
				await page.setViewportSize({ width, height: 800 });
				await page.evaluate(() => window.scrollTo(0, 0));
				const scrollbarWidth = await page.evaluate(() => innerWidth - document.documentElement.clientWidth);
				const expected = resolveResponsiveLayout({ width, height: 800, scrollbarWidth });
				await expect.poll(async () => (await menu.boundingBox())!.height).toBe(expected.menu.height);
				const bounds = (await menu.boundingBox())!;
				expect(bounds.x).toBeCloseTo(expected.menu.x, 0);
				expect(bounds.width).toBeCloseTo(expected.menu.width, 0);
				expect(bounds.y).toBeCloseTo(expected.menu.y, 0);
				if (expected.satellites) {
					const box = (await satellite.boundingBox())!;
					expect(box).toMatchObject({ x: expected.satellites.right.x, y: expected.satellites.right.y,
						width: expected.satellites.right.width, height: expected.satellites.right.height });
				} else await expect(satellite).toBeHidden();
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			}
			await page.setViewportSize({ width: 1700, height: 800 });
			for (const requested of [0, 48, 112, 140, 300, 140, 0]) {
				await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), requested);
				await expect.poll(() => page.evaluate(() => scrollY)).toBe(requested);
				await expect.poll(async () => (await menu.boundingBox())!.y).toBeCloseTo(16 + resolveMenuOffset(requested), 0);
				await expect.poll(async () => (await satellite.boundingBox())!.y).toBeCloseTo(28 + resolveMenuOffset(requested), 0);
			}
			await page.setViewportSize({ width: 2300, height: 800 });
			await page.goto('/demo/elements/cube');
			await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'instant' }));
			expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
			await expect.poll(async () => (await menu.boundingBox())!.y).toBeCloseTo(16, 0);
			await expect.poll(async () => (await satellite.boundingBox())!.y).toBeCloseTo(28, 0);
			const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
			await expect(breadcrumb).toHaveCSS('height', '40px');
			await expect(breadcrumb.locator('[aria-current="page"]')).toBeHidden();
		} finally { await context.close(); }
	});
}

test('native menu links remain reachable on small screens', async ({ browser, baseURL }) => {
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
	try {
		const page = await context.newPage();
		await page.goto('/demo/layout-cards');
		await page.locator('.compact-links summary').click();
		await page.locator('.compact-links').getByRole('link', { name: 'List', exact: true }).click();
		await expect(page).toHaveURL(/\/demo\/categories\/list$/);
	} finally { await context.close(); }
});

test('appearance actions fit satellites and remain reachable inside the compact menu', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.setViewportSize({ width: 1700, height: 800 });
	await page.goto('/demo/layout-cards');
	await page.locator('[data-spatial-shell-right]').getByRole('button', { name: 'Appearance', exact: true }).click();
	const popup = page.locator('[data-appearance-popover]:popover-open');
	await expect(popup.getByRole('button', { name: 'System appearance' })).toBeVisible();
	await popup.getByRole('button', { name: 'Dark mode' }).click();
	await expect(page.locator('.brand-stage-shell')).toHaveAttribute('data-color-scheme', 'dark');
	await page.setViewportSize({ width: 320, height: 700 });
	await page.locator('[data-spatial-shell-menu]').getByRole('button', { name: 'Appearance', exact: true }).click();
	await expect(popup.getByRole('button', { name: 'System appearance' })).toBeVisible();
	await popup.getByRole('button', { name: 'Light mode' }).click();
	await expect(page.locator('.brand-stage-shell')).toHaveAttribute('data-color-scheme', 'light');
});

test('the virtual document uses one shell compensation and keeps menu content alive across navigation', async ({ page }) => {
	await page.setViewportSize({ width: 1700, height: 800 });
	await page.goto('/demo/layout-cards');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', /enhanced|fallback|unsupported/, { timeout: 45_000 });
	test.skip(!(await page.locator('.stage').evaluate(node => node.classList.contains('stage-virtual-scroll-active'))), 'WebGPU enhancement unavailable');
	await page.locator('[data-spatial-shell-menu]').evaluate(node => (node as HTMLElement).dataset.lifetimeProbe = 'persistent');
	for (const target of [0, 48, 112, 140, 300, 0]) {
		await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), target);
		await expect.poll(async () => (await page.locator('.spatial-shell-menu').boundingBox())!.y).toBeCloseTo(16 + resolveMenuOffset(target), 0);
	}
	await page.locator('[data-spatial-shell-menu]').getByRole('link', { name: 'List', exact: true }).click();
	await expect(page).toHaveURL(/\/demo\/categories\/list$/);
	await expect(page.locator('[data-spatial-shell-menu]')).toHaveAttribute('data-lifetime-probe', 'persistent');
	await expect(page.locator('[data-spatial-shell-menu]')).toBeVisible();
});

for (const source of ['list', 'carousel']) {
	test(`${source} to detail keeps the top menu visible throughout the transition`, async ({ page }) => {
		await page.setViewportSize({ width: 1700, height: 1200 });
		await page.goto(`/demo/categories/${source}?stage-test=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', /enhanced|fallback|unsupported/, { timeout: 45_000 });
		test.skip(!(await page.locator('.stage').evaluate(node => node.classList.contains('stage-virtual-scroll-active'))), 'WebGPU enhancement unavailable');
		await expect(page.locator(source === 'list' ? '.spatial-element-card' : '.carousel-spatial-element.selected').first())
			.toHaveAttribute('data-catalog-model-ready', '');
		await page.locator('[data-spatial-shell-menu]').evaluate(node => (node as HTMLElement).dataset.lifetimeProbe = 'persistent');
		await page.evaluate(() => {
			const samples: { transitioning: boolean; opacity: number }[] = [];
			let frame = 0;
			const sample = () => {
				let opacity = 0;
				// Decorative capture copies intentionally strip author data attributes.
				for (const menu of document.querySelectorAll<HTMLElement>('.spatial-shell-menu-content')) {
					const rect = menu.getBoundingClientRect();
					if (rect.width < 100 || rect.height < 20 || rect.top < -1 || rect.bottom > 100) continue;
					let alpha = 1;
					for (let ancestor: HTMLElement | null = menu; ancestor; ancestor = ancestor.parentElement) {
						const style = getComputedStyle(ancestor);
						if (style.visibility !== 'visible' || style.display === 'none') { alpha = 0; break; }
						alpha *= Number(style.opacity);
					}
					opacity = Math.max(opacity, alpha);
				}
				samples.push({ transitioning: Boolean(document.querySelector('.stage[data-catalog-transition]')), opacity });
				frame = requestAnimationFrame(sample);
			};
			(window as typeof window & { stopShellProbe: () => typeof samples }).stopShellProbe = () => { cancelAnimationFrame(frame); return samples; };
			sample();
		});
		const link = source === 'list' ? page.locator('.spatial-element-card').first()
			: page.locator('.carousel-spatial-element.selected .spatial-element-target').first();
		// A tall viewport keeps the complete 3D hit rectangle visible while the
		// pointer and source geometry settle before the intended top-to-top click.
		await link.hover();
		await page.evaluate(() => window.__stageVisualTest!.settle(30));
		expect(await page.evaluate(() => scrollY)).toBe(0);
		await link.click();
		await expect(page).toHaveURL(/\/demo\/elements\//);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
		const samples = await page.evaluate(() => (window as typeof window & {
			stopShellProbe: () => { transitioning: boolean; opacity: number }[]
		}).stopShellProbe());
		expect(samples.some(sample => sample.transitioning)).toBe(true);
		expect(samples.every(sample => sample.opacity >= 0.95)).toBe(true);
		await expect(page.locator('[data-spatial-shell-menu]')).toHaveAttribute('data-lifetime-probe', 'persistent');
	});
}
