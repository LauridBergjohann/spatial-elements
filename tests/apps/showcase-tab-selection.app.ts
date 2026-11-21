import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) for (const width of [1700, 2456]) {
	test(`detail selection follows the theme and animates only outer corners at ${width}px (enhanced: ${enhanced})`, async ({ page }, info) => {
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width, height: 1000 });
		await page.goto('/showcase/consumer/logitech-brio-500/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
		const tabs = page.locator('[data-spatial-element-tab-list]');
		const links = tabs.locator('[data-spatial-element-tab-id]');
		const selection = tabs.locator('[data-spatial-element-tab-selection]');
		await expect(tabs.locator('[data-spatial-element-tab-indicator-ready]')).toBeVisible();
		for (const [mode, color] of [['Dark', 'rgb(31, 31, 31)'], ['Light', 'rgb(238, 238, 238)']]) {
			await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
			await expect(selection).toHaveCSS('background-color', color);
		}
		const radii = () => selection.evaluate(node => {
			const css = getComputedStyle(node);
			return [css.borderTopLeftRadius, css.borderTopRightRadius, css.borderBottomRightRadius, css.borderBottomLeftRadius].map(parseFloat);
		});
		await expect(links.first()).toHaveAttribute('aria-current', 'location');
		await expect.poll(async () => (await radii())[3]).toBeGreaterThan(0);
		expect((await radii()).slice(1, 3)).toEqual([0, 0]);
		// Sample real transition frames: the round left edge must shrink while the surface travels.
		await selection.evaluate(node => {
			const frames: { left: number; radius: number }[] = [];
			Object.assign(window, { tabSelectionFrames: frames });
			const end = performance.now() + 2000;
			function sample() {
				const style = getComputedStyle(node);
				frames.push({ left: new DOMMatrixReadOnly(style.transform).m41, radius: parseFloat(style.borderBottomLeftRadius) });
				if (performance.now() < end) requestAnimationFrame(sample);
			}
			requestAnimationFrame(sample);
		});
		const initialRadius = (await radii())[3];
		await links.nth(1).click();
		await expect(links.nth(1)).toHaveAttribute('aria-current', 'location');
		await expect.poll(radii).toEqual([0, 0, 0, 0]);
		const frames = await page.evaluate(() => (window as unknown as { tabSelectionFrames: { left: number; radius: number }[] }).tabSelectionFrames);
		expect(frames.some(frame => frame.left > 0 && frame.radius > 0 && frame.radius < initialRadius)).toBe(true);
		await links.last().click();
		await expect(links.last()).toHaveAttribute('aria-current', 'location');
		await expect.poll(async () => (await radii())[2]).toBeGreaterThan(0);
		await expect.poll(async () => [(await radii())[0], (await radii())[3]]).toEqual([0, 0]);
		await page.screenshot({ path: info.outputPath('last-tab.png') });
		// Theme overrides must also work after the navigation has docked.
		await tabs.evaluate(node => (node as HTMLElement).style.setProperty('--spatial-element-tab-background', '#123456'));
		await expect(selection).toHaveCSS('background-color', 'rgb(18, 52, 86)');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(selection).toHaveCSS('transition-duration', '0s');
		// At the last anchor the footer can cover the fixed 3XL tabs. Scroll back as a reader would.
		await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
		await expect(links.first()).toHaveAttribute('aria-current', 'location');
		await expect.poll(async () => (await radii())[3]).toBeGreaterThan(0);
		expect((await radii()).slice(1, 3)).toEqual([0, 0]);
	});
}
