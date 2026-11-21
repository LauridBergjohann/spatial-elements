import { expect, test, type Locator } from '@playwright/test';

async function expectTopmost(locator: Locator) {
	await expect(locator).toBeVisible();
	await expect.poll(() => locator.evaluate(node => {
		const r = node.getBoundingClientRect();
		const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
		return hit === node || node.contains(hit);
	})).toBe(true);
}

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	for (const width of [390, 1440, 1920, 2456]) {
		test(`header overlays cover stage controls at ${width}px (enhanced: ${enhanced})`, async ({ page }, info) => {
			if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
			await page.setViewportSize({ width, height: 1000 });
			await page.goto('/showcase/consumer/logitech-brio-500/');
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
			if (width >= 2300) {
				await page.evaluate(() => scrollTo({ top: 250, behavior: 'instant' }));
				await expect.poll(() => page.evaluate(() => scrollY)).toBe(250);
			}
			if (width >= 1200) {
				const trigger = page.locator('.desktop-menu').getByRole('link', { name: 'Documentation', exact: true });
				await trigger.hover();
				const panel = page.locator('.ps-submenu:popover-open');
				await expect(panel).toBeVisible();
				const target = panel.getByRole('link', { name: 'Content pages', exact: true });
				await expectTopmost(target);
				await target.hover();
				// Moving into the promoted panel must not break hover ownership or its highlight.
				await page.waitForTimeout(250);
				await expect(trigger).toHaveAttribute('aria-expanded', 'true');
				await expect(panel).toBeVisible();
				await page.screenshot({ path: info.outputPath('menu-over-stage.png') });
				await page.keyboard.press('Escape');
				await expect(page.locator('.ps-submenu:popover-open')).toHaveCount(0);
			} else {
				await page.getByLabel('Open navigation', { exact: true }).click();
				await expectTopmost(page.locator('.mobile-panel:popover-open').getByRole('link', { name: 'Documentation', exact: true }));
				await page.keyboard.press('Escape');
			}
			if (width < 800) await page.getByRole('button', { name: 'Open search' }).click();
			const input = page.getByRole('combobox', { name: 'Search documentation' });
			await input.fill('theme');
			await expectTopmost(input);
			await expect(page.locator('.search-panel:popover-open')).toBeVisible();
			const result = page.getByRole('option').first();
			await expectTopmost(result);
			await page.screenshot({ path: info.outputPath('search-over-stage.png') });
			await input.press('ArrowDown');
			await expect(result).toHaveAttribute('aria-selected', 'true');
			await input.press('Escape');
			await expect(page.locator('.search-panel')).toHaveCount(0);
			await expect(page.locator(':popover-open')).toHaveCount(0);
			// Reopen and follow a real result to verify retained events and navigation cleanup.
			if (width < 800) await page.getByRole('button', { name: 'Open search' }).click();
			await input.fill('theme');
			await page.getByRole('option').first().click();
			await expect(page).toHaveURL(/\/docs\/interaction\/themes\//);
			await expect(page.locator(':popover-open')).toHaveCount(0);
		});
	}
}
