import { expect, test } from '@playwright/test';
import products from '../../apps/website/src/lib/showcase/products.json' with { type: 'json' };

test('Every showcase manufacturer has quantity, illustrative totals and an exit CTA', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	for (const [brand, segment, label, href] of [
		['wera', 'workbench', 'Wera', 'https://www.wera.de/'],
		['logitech', 'consumer', 'Logitech', 'https://www.logitech.com/'],
		['watches', 'exclusive', 'Rolex', 'https://www.rolex.com/'],
		['item', 'industrial', 'item', 'https://www.item24.com/'],
		['wurm', 'industrial', 'wurm', 'https://www.wurm.de/']
	]) {
		const product = products.find(product => product.manufacturer === brand)!;
		await page.goto(`/showcase/${segment}/${product.id}/`);
		const summary = page.locator('.summary-presentation').filter({ visible: true });
		await expect(summary.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('1');
		await expect(summary.locator('output')).toContainText(/€[\d,.]+/);
		await expect(summary).toContainText('Illustrative price only. Not for sale on this website.');
		const action = summary.getByRole('link', { name: `Visit ${label}`, exact: true });
		await expect(action).toHaveAttribute('href', href);
		await expect(action.locator('svg.lucide-square-arrow-right-exit')).toHaveCount(1);
		await summary.getByRole('spinbutton', { name: 'Quantity' }).fill('2');
		await expect(summary.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('2');
	}
});

test('Branded summaries follow the selected theme, including after navigation', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/showcase/industrial/');
	await page.getByRole('button', { name: 'Dark', exact: true }).filter({ visible: true }).click();
	for (const [brand, id, extension] of [['wurm', 'wurm-asv101', 'webp'], ['item', 'item-profile', 'svg']]) {
		await page.goto(`/showcase/industrial/${id}/`);
		const logo = page.locator('.summary-presentation .manufacturer-logo img');
		await expect(logo).toHaveAttribute('src', `/assets/brands/${brand}-logo-dark.${extension}`);
		await expect.poll(() => logo.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
		await page.getByRole('button', { name: 'Light', exact: true }).filter({ visible: true }).click();
		await expect(logo).toHaveAttribute('src', `/assets/brands/${brand}-logo.${extension}`);
		await page.getByRole('button', { name: 'Dark', exact: true }).filter({ visible: true }).click();
	}
});

if (process.env.SPATIAL_GPU) for (const width of [320, 390, 1700, 2400]) {
	test(`Quantity and total stay synchronized with the header at ${width}px`, async ({ page }, info) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/consumer/logitech-z407/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		const summary = page.locator('.summary-presentation');
		await summary.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
		await expect(summary.locator('output')).toHaveText('€387.00');
		await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'instant' }));
		const header = page.locator(width >= 2300 ? '[data-spatial-detail-pane-header]' : '[data-spatial-element-sticky-header]');
		const quantity = header.getByRole('spinbutton', { name: 'Quantity' });
		await expect(quantity).toBeVisible();
		await expect(quantity).toHaveValue('3');
		await expect(header.locator('output')).toHaveText('€387.00');
		await quantity.fill('4');
		await expect(summary.getByRole('spinbutton', { name: 'Quantity', includeHidden: true })).toHaveValue('4');
		await expect(header.locator('output')).toHaveText('€516.00');
		await expect(header.locator('.lucide-square-arrow-right-exit')).toBeVisible();
		// Both controls fit the visible header, even at the narrowest supported layout.
		for (const locator of [quantity, header.locator('output')]) {
			const box = (await locator.boundingBox())!;
			expect(box.x).toBeGreaterThanOrEqual(0);
			expect(box.x + box.width).toBeLessThanOrEqual(width);
		}
		await page.screenshot({ path: info.outputPath(`order-header-${width}.png`) });
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
		await expect(summary.getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('4');
		await expect(summary.locator('output')).toHaveText('€516.00');
		expect(errors).toEqual([]);
	});
}

if (process.env.SPATIAL_GPU) for (const width of [390, 1700, 2400]) {
	test(`Header fields fade in only once covered at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/consumer/logitech-z407/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		const headerSelector = width >= 2300 ? '[data-spatial-detail-pane-header]' : '[data-spatial-element-sticky-header]';
		const header = page.locator(headerSelector);
		for (const key of ['quantity', 'price', 'primary-action']) {
			const sourceSelector = key === 'primary-action' ? '[data-catalog-rich-shared="primary-action"]' : `[data-spatial-element-header-field="${key}"]`;
			const targetSelector = key === 'primary-action' ? '[data-spatial-element-dock-action]' : sourceSelector;
			const target = header.locator(targetSelector);
			for (const offset of [-4, 4, -4]) {
				await page.evaluate(({ headerSelector, sourceSelector, offset }) => {
					const source = document.querySelector(`.summary-presentation ${sourceSelector}`)!;
					const header = document.querySelector(headerSelector)!;
					window.scrollTo({ top: scrollY + source.getBoundingClientRect().bottom - header.getBoundingClientRect().bottom + offset, behavior: 'instant' });
				}, { headerSelector, sourceSelector, offset });
				await expect.poll(() => page.evaluate(({ headerSelector, sourceSelector }) =>
					Math.round(document.querySelector(`.summary-presentation ${sourceSelector}`)!.getBoundingClientRect().bottom - document.querySelector(headerSelector)!.getBoundingClientRect().bottom),
				{ headerSelector, sourceSelector })).toBe(-offset);
				if (offset > 0) {
					await expect(target).toHaveAttribute('data-header-field-visible', '');
					await expect(target).toHaveCSS('opacity', '1');
					await expect(target).not.toHaveAttribute('inert');
				} else {
					await expect(target).not.toHaveAttribute('data-header-field-visible');
					await expect(target).toHaveCSS('opacity', '0');
					await expect(target).toHaveAttribute('inert', '');
				}
			}
			await expect(target).toHaveCSS('transition-duration', '0.18s, 0.18s, 0s');
		}
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(header.locator('[data-spatial-element-header-field="quantity"]')).toHaveCSS('transition-duration', '0s');
	});
}
