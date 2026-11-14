import { expect, test } from '@playwright/test';
import sharp from 'sharp';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	test(`Industrial groups manufacturers and scopes its frosted theme (enhanced: ${enhanced})`, async ({ page }, info) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/showcase/industrial/');
		if (enhanced) await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
		await expect(page.getByRole('heading', { name: 'Industrial', exact: true })).toBeVisible();
		await expect(page.locator('#example-products h2')).toHaveCount(0);
		await expect(page.locator('#item-products h2, #wurm-products h2')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'item - Industrial Modular System', exact: true })).toBeAttached();
		await expect(page.getByRole('heading', { name: 'wurm - refrigeration control systems', exact: true })).toBeAttached();
		await expect(page.locator('#example-products [data-carousel-spatial-element]')).toHaveCount(4);
		await expect(page.locator('#example-products a[href="/showcase/industrial/wurm-fkl003/"]').first()).toBeAttached();
		await expect(page.locator('#example-products a[href="/showcase/industrial/item-impact-protector/"]').first()).toBeAttached();
		await expect(page.locator('#item-products [data-catalog-card]')).toHaveCount(5);
		await expect(page.locator('#wurm-products [data-catalog-card]')).toHaveCount(8);
		await expect(page.locator('#item-products')).toContainText('0.0.026.33');
		await expect(page.locator('#wurm-products')).toContainText('HKS-G4');
		await expect(page.locator('#item-products [data-card-size]').first()).toHaveAttribute('data-card-size', 'm');
		await expect(page.locator('#wurm-products [data-card-size]').first()).toHaveAttribute('data-card-size', 'm');
		const intro = page.locator('#item-introduction .ps-media-pair');
		await expect(intro).toHaveAttribute('data-side', 'right');
		for (const brand of ['item', 'wurm']) {
			await expect(page.locator(`#${brand}-introduction img`)).toBeAttached();
			await expect(page.locator(`#${brand}-introduction a`)).toHaveAttribute('href', brand === 'item' ? 'https://www.item24.com/' : 'https://www.wurm.de/');
		}
		const header = page.locator('.ps-navigation .header');
		for (const mode of ['Dark', 'Light']) {
			await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
			await expect(header).toHaveCSS('border-radius', '8px');
			await expect.poll(() => header.evaluate(el => getComputedStyle(el).getPropertyValue('--ps-accent').trim())).toBe('#135a77');
			await expect(page.locator('.appearance').filter({ visible: true })).toHaveCSS('border-radius', '8px');
			await page.screenshot({ path: info.outputPath(`industrial-${mode}.png`) });
		}
		// Follow a real card so routing, the branded panel and breadcrumb are checked together.
		const target = page.locator('#wurm-products').getByRole('link', { name: 'Refrigeration Master Module', exact: true });
		if (enhanced) {
			// The spatial stage owns scrolling; drive it with real wheel input.
			const rect = (await target.boundingBox())!;
			await page.mouse.move(1650, 450);
			await page.mouse.wheel(0, rect.y + rect.height / 2 - 450);
			await expect(target).toBeInViewport({ ratio: 0.99 });
			await expect(target).toHaveAttribute('data-catalog-model-ready', '', { timeout: 60000 });
		}
		await target.click();
		await expect(page).toHaveURL(/\/industrial\/wurm-hks-g4\/$/);
		if (enhanced) {
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
			await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
			await expect(page.locator('[data-stage-panel-bound][data-stage-panel-surface="frosted"]').first()).toBeAttached();
		}
		const summary = page.locator('.summary-presentation').filter({ visible: true });
		await expect(summary.getByRole('img', { name: 'Wurm', exact: true })).toBeVisible();
		await expect(summary.getByRole('link', { name: 'Visit wurm', exact: true })).toHaveAttribute('href', 'https://www.wurm.de/');
		await expect(summary.locator('.spatial-element-action-surface')).toHaveCSS('border-radius', '8px');
		await expect(summary.locator('.spatial-element-action-surface')).toHaveCSS('height', '54px');
		await expect(summary.locator('.manufacturer-logo')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await summary.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
		await expect(summary.locator('output')).toContainText('1,197.00');
		await page.screenshot({ path: info.outputPath('wurm-detail.png') });
		await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true }).filter({ visible: true }).first().getByRole('link', { name: 'Industrial', exact: true })).toHaveAttribute('href', '/showcase/industrial/');
		await page.goto('/showcase/industrial/item-profile/');
		await expect(page.locator('.summary-presentation').filter({ visible: true }).getByRole('img', { name: 'item', exact: true })).toBeVisible();
		await expect(page.locator('.summary-presentation').filter({ visible: true }).getByRole('link', { name: 'Visit item', exact: true })).toHaveAttribute('href', 'https://www.item24.com/');
		await page.goto('/showcase/');
		await expect(header).toHaveCSS('border-radius', '12px');
		await expect.poll(() => header.evaluate(el => getComputedStyle(el).getPropertyValue('--ps-accent').trim())).toBe('#007b5e');
		expect(errors).toEqual([]);
	});
}

if (process.env.SPATIAL_GPU) for (const mode of ['light', 'dark']) test(`Industrial retains its branded summary through a carousel transition (${mode})`, async ({ page }, info) => {
	await page.addInitScript(mode => localStorage.setItem('spatial-elements-theme', mode), mode);
	await page.goto('/showcase/industrial/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	const card = page.locator('#example-products .carousel-spatial-element.selected');
	const bounds = (await card.boundingBox())!;
	await page.mouse.move(1650, 500);
	await page.mouse.wheel(0, bounds.y + bounds.height / 2 - 500);
	await expect(card).toBeInViewport({ ratio: 0.99 });
	await expect(card).toHaveAttribute('data-catalog-model-ready', '', { timeout: 60000 });
	const summary = card.locator('.summary-presentation');
	await expect(summary.getByRole('img', { name: 'Wurm', exact: true })).toBeVisible();
	await expect(summary.locator('.manufacturer-logo img')).toHaveAttribute('src', `/assets/brands/wurm-logo${mode === 'dark' ? '-dark' : ''}.webp`);
	await expect(card.locator('.spatial-summary-surface')).toHaveCSS('backdrop-filter', 'blur(5px)');
	const liveSummary = await summary.elementHandle();
	await summary.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
	await summary.evaluate(el => {
		const state = window as unknown as { logoFrames: unknown[]; stopLogoFrames: boolean };
		state.logoFrames = []; state.stopLogoFrames = false;
		const sample = () => {
			const logos = [el.querySelector('img')!, ...document.querySelectorAll('[data-catalog-actor-role="leading"] img')];
			let opacity = 0;
			for (const logo of logos) {
				let alpha = logo.isConnected && getComputedStyle(logo).visibility === 'visible' && logo.getBoundingClientRect().width > 0 ? 1 : 0;
				for (let node: Element | null = logo; node; node = node.parentElement) {
					const css = getComputedStyle(node);
					alpha *= css.display === 'none' ? 0 : Number(css.opacity);
				}
				opacity += alpha;
			}
			const stage = document.querySelector<HTMLElement>('.stage')!;
			state.logoFrames.push({ opacity, phase: stage.dataset.catalogStagedPhase, decision: stage.dataset.catalogStagedDecision, transition: stage.dataset.catalogTransition });
			if (!state.stopLogoFrames) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await page.screenshot({ path: info.outputPath('industrial-carousel.png') });
	await card.locator('.spatial-element-target').click();
	await expect(page).toHaveURL(/\/industrial\/wurm-asv101\/$/);
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	expect(await liveSummary!.evaluate(el => el.isConnected && el.querySelector('h1')?.textContent?.trim() === 'Compressor Control Module')).toBe(true);
	const frames = await page.evaluate(() => {
		const state = window as unknown as { logoFrames: unknown[]; stopLogoFrames: boolean };
		state.stopLogoFrames = true; return state.logoFrames;
	});
	await info.attach('logo-frames', { body: JSON.stringify(frames), contentType: 'application/json' });
	expect(frames.filter(frame => (frame as { opacity: number }).opacity < 0.9)).toEqual([]);
	await expect(page.locator('.summary-presentation').filter({ visible: true }).getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('3');
	await expect(page.locator('.summary-presentation').filter({ visible: true }).locator('.manufacturer-logo img')).toHaveAttribute('src', `/assets/brands/wurm-logo${mode === 'dark' ? '-dark' : ''}.webp`);
	await expect(page.locator('.summary-presentation').filter({ visible: true }).getByRole('link', { name: 'Visit wurm', exact: true })).toBeVisible();
	await page.screenshot({ path: info.outputPath('industrial-after-transition.png') });
});

if (process.env.SPATIAL_GPU) test('Industrial outline and minimap use the exact accent in both themes', async ({ page }, info) => {
	await page.goto('/showcase/industrial/wurm-asv101/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	for (const mode of ['Light', 'Dark']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		const box = await page.evaluate(() => window.__stageVisualTest!.getModelRect());
		expect(box).not.toBeNull();
		await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
		await page.waitForTimeout(700);
		await page.evaluate(() => window.__stageVisualTest!.settle(3));
		const bounds = await page.evaluate(() => ({ model: window.__stageVisualTest!.getModelRect()!, minimap: window.__stageVisualTest!.getMinimapRect()! }));
		const screenshot = await page.screenshot({ path: info.outputPath(`industrial-outline-${mode}.png`) });
		const { data, info: image } = await sharp(screenshot).raw().toBuffer({ resolveWithObject: true });
		const matches = (x: number, y: number) => {
			const i = (y * image.width + x) * image.channels;
			return Math.max(...[19, 90, 119].map((value, channel) => Math.abs(data[i + channel] - value))) <= 3;
		};
		let pixels = 0;
		const model = bounds.model;
		for (let y = Math.max(0, Math.floor(model.y - 5)); y < Math.min(image.height, model.y + model.height + 5); y++)
			for (let x = Math.max(0, Math.floor(model.x - 5)); x < Math.min(image.width, model.x + model.width + 5); x++)
				if (matches(x, y)) pixels++;
		expect(pixels, `Visible geometry outline in ${mode}`).toBeGreaterThan(100);
		const map = bounds.minimap;
		const y = Math.floor(map.y + map.height / 2);
		expect(Array.from({ length: 5 }, (_, dx) => matches(Math.floor(map.x) + dx, y)).some(Boolean), `Minimap ring in ${mode}`).toBe(true);
	}
});

if (process.env.SPATIAL_GPU) test('Primary and scroll-header actions measure 54px across detail layouts', async ({ page }) => {
	for (const width of [390, 1700, 2400]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/industrial/wurm-asv101/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
		await expect(page.locator('.summary-presentation .spatial-element-action-surface')).toHaveCSS('height', '54px');
		await page.evaluate(() => window.scrollTo({ top: 1800, behavior: 'instant' }));
		const action = page.locator(width >= 2300 ? '.spatial-element-pane-action' : '.sticky-header-action');
		await expect(action).toBeVisible();
		await expect(action).toHaveCSS('width', '54px');
		await expect(action).toHaveCSS('height', '54px');
	}
});

test.describe('Industrial without JavaScript', () => {
	test.use({ javaScriptEnabled: false });
	test('company introductions and products work on desktop and mobile', async ({ page }, info) => {
		for (const width of [1700, 390]) {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/showcase/industrial/');
			for (const brand of ['item', 'wurm']) {
				const section = page.locator(`#${brand}-introduction`);
				await section.scrollIntoViewIfNeeded();
				await expect(section.getByRole('link', { name: `Discover ${brand === 'item' ? 'item' : 'Wurm'}` })).toBeVisible();
				await expect.poll(() => section.locator('img').evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
				await section.screenshot({ path: info.outputPath(`${brand}-${width}.png`) });
			}
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.locator('#item-products').getByRole('link', { name: 'Profile 8 40 × 40 Light', exact: true }).click();
			await expect(page).toHaveURL(/\/industrial\/item-profile\/$/);
			await expect(page.locator('.summary-presentation').getByRole('link', { name: 'Visit item', exact: true })).toBeVisible();
		}
	});
});
