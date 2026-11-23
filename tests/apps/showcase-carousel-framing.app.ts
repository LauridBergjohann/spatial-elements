import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('first carousel reveals the next heading across viewport sizes and stays stable while scrolling', async ({ page }, info) => {
	await page.goto('/showcase/industrial/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	const carousel = page.locator('.carousel-drag-section').first();
	const selected = carousel.locator('.carousel-spatial-element.selected');
	await expect(selected).toHaveAttribute('data-catalog-model-ready', '');
	for (const [width, height] of [[390, 670], [485, 435], [600, 700], [840, 690], [1200, 700], [1600, 760], [1920, 913], [2456, 1000]]) {
		await page.setViewportSize({ width, height });
		await page.evaluate(() => scrollTo(0, 0));
		await expect.poll(() => carousel.evaluate(node => {
			const next = node.nextElementSibling!;
			const heading = next.querySelector('h2, h3')!;
			return heading.getBoundingClientRect().bottom;
		})).toBeLessThanOrEqual(height - 4);
		const before = (await carousel.boundingBox())!;
		if (width < 840) {
			const summary = (await selected.locator('.summary').boundingBox())!;
			const arrow = (await selected.locator('.compact-arrow').boundingBox())!;
			expect(arrow.y - summary.y).toBeCloseTo(10, 0);
			expect(summary.x + summary.width - arrow.x - arrow.width).toBeCloseTo(10, 0);
			await expect.poll(() => page.evaluate(() => {
				const actors = window.__stageVisualTest!.getCarouselStats()!.actors;
				return actors.filter(actor => actor.clip && actor.opacity > 0).every(actor => actor.band === 'rear');
			})).toBe(true);
		}
		await page.screenshot({ path: info.outputPath(`industrial-${width}.png`) });
		await page.evaluate(() => scrollBy(0, 100));
		expect((await carousel.boundingBox())!.height).toBeCloseTo(before.height, 0);
	}
});

test('consumer introductory text is included in the first carousel height', async ({ page }, info) => {
	await page.goto('/showcase/consumer/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	for (const [width, height] of [[390, 844], [600, 900], [1200, 900], [1920, 1080]]) {
		await page.setViewportSize({ width, height });
		await page.evaluate(() => scrollTo(0, 0));
		const next = page.getByRole('heading', { name: 'The collection', exact: true });
		await expect.poll(async () => { const box = (await next.boundingBox())!; return box.y + box.height; }).toBeLessThanOrEqual(height - 4);
		await page.screenshot({ path: info.outputPath(`consumer-${width}.png`) });
	}
});
