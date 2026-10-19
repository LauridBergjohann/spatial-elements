import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const surface of ['frosted', 'glass']) test(`carousel ${surface}: dots follow dragging, blur follows depth, and distant selections animate`, async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', e => errors.push(e.message));
	page.on('console', message => {
		if (message.type() === 'error' && /WebGPU|Validation|Shader|WGSL/.test(message.text())) errors.push(message.text());
	});
	await page.goto('/demo/categories/carousel?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	if (surface === 'glass') await page.locator('[data-carousel-spatial-element]').evaluateAll(nodes => {
		for (const node of nodes) (node as HTMLElement).dataset.carouselSurface = 'glass';
	});
	const carousel = page.locator('[data-carousel-section]').first();
	const controls = carousel.locator('.controls button');
	const item = carousel.locator('[data-carousel-item]').first();
	await expect(item).toHaveAttribute('data-catalog-model-ready');
	await item.locator('.spatial-element-target').scrollIntoViewIfNeeded();
	await page.evaluate(() => window.__stageVisualTest!.settle(40));
	const bounds = (await item.locator('.spatial-element-target').boundingBox())!;
	const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x - 150, y, { steps: 12 });
	await expect(controls.nth(1)).toHaveAttribute('aria-pressed', 'true');
	await expect(controls.first()).toHaveAttribute('aria-pressed', 'false');
	const panel = item.locator('.summary');
	expect(await panel.evaluate(el => parseFloat(getComputedStyle(el).filter.replace('blur(', '')))).toBeGreaterThan(3);
	await page.screenshot({ path: info.outputPath('carousel-drag-focus.png') });
	await page.mouse.move(x, y, { steps: 12 });
	await expect(controls.first()).toHaveAttribute('aria-pressed', 'true');
	await page.mouse.up();
	await expect(panel).toHaveCSS('filter', 'none');
	await page.mouse.move(800, 800);
	await page.mouse.wheel(0, 350);
	await expect(controls.last()).toBeInViewport();
	await page.evaluate(() => {
		const samples: number[] = [];
		Object.assign(window, { carouselPhases: samples });
		const sample = () => {
			const buttons = [...document.querySelectorAll('.controls button')];
			samples.push(buttons.findIndex(b => b.getAttribute('aria-pressed') === 'true'));
			if (samples.length < 120) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await controls.last().click();
	await expect(controls.last()).toHaveAttribute('aria-pressed', 'true');
	await expect(carousel.locator('[data-carousel-item]').last().locator('.summary')).toHaveCSS('filter', 'none');
	expect(await page.evaluate(() => (window as any).carouselPhases.some((value: number) => value > 0 && value < 4))).toBe(true);
	const stats = await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!);
	expect(stats.depthBlur.targets).toBe(3);
	expect(stats.depthBlur.size).toBe(512);
	expect(stats.actors.some(actor => actor.blur > 0)).toBe(true);
	await page.mouse.move(1, 1);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const passes = await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!.passes);
	await page.waitForTimeout(300);
	expect(await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!.passes)).toBe(passes);
	expect(errors).toEqual([]);
});
