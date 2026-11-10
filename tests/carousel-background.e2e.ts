import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import { waitForCatalogIdle } from './helpers/catalogIdle';

for (const [size, material] of [
	['standard', 'frosted'],
	['full', 'frosted'],
	['standard', 'glass'],
	['full', 'glass']
]) {
	test(`opaque ${size} carousel with ${material} panels shows rear models only inside its surface`, async ({
		page
	}, info) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize({ width: 1800, height: 1000 });
		await page.goto(`/proof/carousel-layout?background=${size}&stage-test=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		await expect(page.locator('[data-carousel-item].selected')).toHaveAttribute(
			'data-catalog-model-ready'
		);
		if (material === 'glass')
			await page.locator('[data-carousel-spatial-element]').evaluateAll((nodes) => {
				for (const node of nodes) (node as HTMLElement).dataset.carouselSurface = 'glass';
			});
		await page.mouse.move(1, 1);
		await page.evaluate(() => window.__stageVisualTest!.settle(60));
		await waitForCatalogIdle(page, info);
		const surface = page.locator('#layout-carousel > .ps-section-surface');
		const bounds = (await surface.boundingBox())!;
		const stats = await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!);
		expect(stats.actors.some((actor) => actor.band === 'rear' && actor.opacity > 0)).toBe(true);
		for (const actor of stats.actors) {
			expect(actor.clip!.left).toBeCloseTo(bounds.x, 0);
			expect(actor.clip!.top).toBeCloseTo(bounds.y, 0);
			expect(actor.clip!.width).toBeCloseTo(bounds.width, 0);
			expect(actor.clip!.height).toBeCloseTo(bounds.height, 0);
		}
		if (size === 'standard') expect(bounds.width).toBeLessThan(1800);
		else expect(bounds.width).toBeCloseTo(1800, 0);
		const visible = await page.screenshot({ path: info.outputPath('carousel-visible.png') });
		const rear = page.locator('.stage-webgpu-carousel-rear');
		// Summaries must remain above the rear band; raising the whole canvas above
		// the document would fix opaque backgrounds while obscuring live panel text.
		const layers = await page.evaluate(() => {
			const z = (selector: string) =>
				Number(getComputedStyle(document.querySelector(selector)!).zIndex);
			return {
				background: z('.stage-carousel-surface'),
				rear: z('.stage-webgpu-carousel-rear'),
				content: z('.stage-virtual-viewport')
			};
		});
		expect(layers.background).toBeLessThan(layers.rear);
		expect(layers.rear).toBeLessThan(layers.content);
		await rear.evaluate((node) => ((node as HTMLElement).style.visibility = 'hidden'));
		const hidden = await page.screenshot();
		await rear.evaluate((node) => (node as HTMLElement).style.removeProperty('visibility'));
		// Compare the actual browser composite, not merely canvas presence or z-index.
		const pixels = await page.evaluate(
			async ({ visible, hidden, bounds }) => {
				async function decode(encoded: string) {
					const image = new Image();
					image.src = 'data:image/png;base64,' + encoded;
					await image.decode();
					const canvas = document.createElement('canvas');
					canvas.width = image.width;
					canvas.height = image.height;
					const context = canvas.getContext('2d')!;
					context.drawImage(image, 0, 0);
					return {
						width: image.width,
						data: context.getImageData(0, 0, image.width, image.height).data
					};
				}
				const a = await decode(visible),
					b = await decode(hidden);
				let inside = 0,
					outside = 0;
				for (let i = 0; i < a.data.length; i += 4) {
					if (Math.max(...[0, 1, 2].map((c) => Math.abs(a.data[i + c] - b.data[i + c]))) < 8)
						continue;
					const x = (i / 4) % a.width,
						y = Math.floor(i / 4 / a.width);
					if (
						x >= bounds.x - 1 &&
						x <= bounds.x + bounds.width + 1 &&
						y >= bounds.y - 1 &&
						y <= bounds.y + bounds.height + 1
					)
						inside++;
					else outside++;
				}
				return { inside, outside };
			},
			{ visible: visible.toString('base64'), hidden: hidden.toString('base64'), bounds }
		);
		expect(pixels.inside, 'rear models must survive the opaque section background').toBeGreaterThan(
			100
		);
		expect(
			pixels.outside,
			'models, glass and shadows must stay inside the section surface'
		).toBeLessThan(20);
		await page.mouse.wheel(0, 180);
		await page.evaluate(() => window.__stageVisualTest!.settle(40));
		const scrolled = (await surface.boundingBox())!;
		const clips = await page.evaluate(() =>
			window.__stageVisualTest!.getCarouselStats()!.actors.map((actor) => actor.clip)
		);
		for (const clip of clips) expect(clip!.top).toBeCloseTo(scrolled.y, 0);
		expect(errors).toEqual([]);
	});
}
