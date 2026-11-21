import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	test(`3XL footer overlays a stationary detail and restores it on reverse scroll (enhanced: ${enhanced})`, async ({ page }, info) => {
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width: 2456, height: 1000 });
		await page.goto('/showcase/consumer/logitech-z407/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
		const fixed = page.locator('.ps-navigation .header, [data-spatial-detail-pane-header], .spatial-element-hero, [data-spatial-detail-pane-submenu-shell]');
		const initial = await fixed.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
		const paneTop = (await page.locator('[data-spatial-detail-pane-header]').boundingBox())!.y;
		const end = await page.locator('.stage').evaluate(node => node.getBoundingClientRect().bottom + scrollY - innerHeight);
		const scroll = async (y: number) => {
			await page.evaluate(top => scrollTo({ top, behavior: 'instant' }), y);
			await expect.poll(() => page.evaluate(() => scrollY)).toBeCloseTo(y, 0);
		};
		await scroll(Math.min(500, end));
		await expect.poll(async () => fixed.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)))).toEqual(initial.map(Math.round));
		await scroll(end + 160);
		await expect.poll(async () => fixed.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)))).toEqual(initial.map(Math.round));
		const footer = page.locator('.ps-footer-main');
		await expect(footer).toBeInViewport();
		const box = (await footer.boundingBox())!;
		expect(Math.abs(box.x + box.width / 2 - 2456 / 2)).toBeLessThan(1);
		if (enhanced) await expect(page.locator('.stage-webgpu-foreground')).toHaveCSS('translate', 'none');
		await expect(page.locator('.spatial-footer')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(page.locator('.stage')).toHaveCSS('--stage-exit-y', '');
		// The footer owns its hit area even above the fixed native/GPU pane.
		expect(await footer.evaluate(node => {
			const r = node.getBoundingClientRect();
			return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + 20));
		})).toBe(true);
		await page.screenshot({ path: info.outputPath('detail-footer.png') });
		await scroll(0);
		await expect.poll(async () => fixed.evaluateAll(nodes => nodes.map(node => Math.round(node.getBoundingClientRect().top)))).toEqual(initial.map(Math.round));
		// Fixed geometry also survives a theme change and resize while the footer is entering.
		await page.getByRole('button', { name: 'Dark', exact: true }).filter({ visible: true }).click();
		await scroll(end + 160);
		await page.setViewportSize({ width: 2600, height: 1000 });
		await expect.poll(async () => page.locator('[data-spatial-detail-pane-header]').evaluate(node => {
			return Math.round(node.getBoundingClientRect().top);
		})).toBe(Math.round(paneTop));
		await page.setViewportSize({ width: 1440, height: 900 });
		await expect(page.locator('.stage')).toHaveCSS('--stage-exit-y', '');
		await page.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
		await page.getByRole('navigation', { name: 'Important links' }).getByRole('link', { name: 'Imprint' }).click();
		await expect(page).toHaveURL(/\/about\/#impressum$/);
		await expect(page.locator('#impressum')).toBeInViewport();
		await expect(page.locator('.stage')).toHaveCSS('--stage-exit-y', '');
	});
}

for (const width of [390, 1440, 2456]) {
	test(`shared footer and navigation icons at ${width}px`, async ({ page }) => {
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width, height: 900 });
		for (const route of ['/', '/showcase/', '/getting-started/', '/docs/', '/about/']) {
			await page.goto(route);
			await expect(page.locator('footer.ps-footer')).toHaveCount(1);
			await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
			await expect(page.getByRole('navigation', { name: 'Important links' })).toBeInViewport();
			await expect(page.locator('.ps-footer-social a[target="_blank"]')).toHaveCount(6);
			for (const [label, href] of [
				['GitHub', 'https://github.com/LauridBergjohann/spatial-elements'],
				['NPM', 'https://www.npmjs.com/package/@spatial-elements/sveltekit'],
				['Vercel', 'https://vercel.com/'], ['Bergjohann', 'https://bergjohann.com/'],
				['LinkedIn', 'https://www.linkedin.com/in/laurid-bergjohann'], ['Svelte', 'https://svelte.dev/']
			]) {
				const social = page.locator('.ps-footer-social').getByRole('link', { name: label, exact: true });
				await expect(social).toHaveAttribute('href', href);
				await expect(social.locator('svg')).toHaveCount(1);
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		}
		await page.evaluate(() => scrollTo(0, 0));
		for (const href of ['/showcase/', '/showcase/consumer/', '/showcase/workbench/', '/showcase/industrial/', '/showcase/exclusive/', '/getting-started/', '/docs/', '/about/']) {
			const links = page.locator(`.ps-navigation a[href="${href}"]`);
			expect(await links.count()).toBeGreaterThan(0);
			for (const link of await links.all()) await expect(link.locator('svg')).toHaveCount(1);
		}
	});
}
