import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test('first carousel reveals the next section across viewport sizes and stays stable while scrolling', async ({ page }, info) => {
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
			return heading.getBoundingClientRect().top;
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

test('showcase property panels fit without scrolling at regular viewport heights', async ({ page }) => {
	test.slow(); // Exercise every product at five full-panel viewport sizes.
	for (const route of ['industrial', 'workbench', 'consumer']) {
		await page.goto(`/showcase/${route}/?stage-test=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
		const carousel = page.locator('.carousel-drag-section').first();
		for (const [width, height] of [[840, 900], [1200, 900], [1600, 900], [1920, 1080], [2456, 1080]]) {
			await page.setViewportSize({ width, height });
			const buttons = carousel.locator('.controls button');
			for (let index = 0; index < await buttons.count(); index++) {
				await buttons.nth(index).click();
				await expect.poll(() => carousel.locator('.selected .spatial-summary-query').evaluate(node =>
					node.scrollHeight - node.clientHeight), `${route}, item ${index}, ${width} × ${height}`).toBeLessThanOrEqual(1);
			}
		}
	}
});

test('carousel height is independent of preceding and following sections', async ({ page }, info) => {
	await page.goto('/showcase/consumer/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	const carousel = page.locator('.carousel-drag-section').first();
	const fit = carousel.locator('.selected [data-carousel-fit-anchor]');
	for (const [width, height] of [[390, 844], [600, 900], [1200, 900], [1920, 1080]]) {
		await page.setViewportSize({ width, height });
		await page.evaluate(() => scrollTo(0, 0));
		const before = (await fit.boundingBox())!;
		const sectionHeight = (await carousel.boundingBox())!.height;
		await carousel.evaluate(node => {
			(node.previousElementSibling as HTMLElement).style.height = '750px';
			(node.nextElementSibling as HTMLElement).style.height = '1500px';
		});
		await expect.poll(async () => (await fit.boundingBox())!.height).toBeCloseTo(before.height, 0);
		expect((await carousel.boundingBox())!.height).toBeCloseTo(sectionHeight, 0);
		await carousel.evaluate(node => {
			(node.previousElementSibling as HTMLElement).style.height = '0px';
			(node.nextElementSibling as HTMLElement).style.height = '0px';
		});
		await expect.poll(async () => (await fit.boundingBox())!.height).toBeCloseTo(before.height, 0);
		expect((await carousel.boundingBox())!.height).toBeCloseTo(sectionHeight, 0);
		await carousel.evaluate(node => {
			(node.previousElementSibling as HTMLElement).style.removeProperty('height');
			(node.nextElementSibling as HTMLElement).style.removeProperty('height');
		});
		await page.screenshot({ path: info.outputPath('consumer-' + width + '.png') });
	}
});
