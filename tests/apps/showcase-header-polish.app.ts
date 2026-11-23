import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const width of [390, 700, 840, 1200, 1700, 2100])
	test(`Dock corners follow the layout at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/industrial/wurm-multigate3/?stage-test=1');
		const header = page.locator('[data-spatial-element-sticky-header]');
		await expect(header).toHaveCSS('border-top-left-radius', '0px');
		await expect(header).toHaveCSS('border-top-right-radius', '0px');
		await expect(header).toHaveCSS('border-bottom-left-radius', width < 1600 ? '0px' : '8px');
		await expect(header).toHaveCSS('border-bottom-right-radius', width < 1600 ? '0px' : '8px');
	});

for (const width of [390, 700])
	test(`Compact carousel copy has inset space at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/consumer/');
		const copy = page
			.locator('.spatial-summary-island[data-presentation-mode="carousel"] .compact-copy')
			.filter({ visible: true })
			.first();
		await expect(copy).toBeVisible();
		await expect(copy).toHaveCSS('padding-left', '12px');
		await expect(copy).toHaveCSS('padding-top', '8px');
		const boxes = await copy.evaluate((el) => ({
			panel: el.closest('.spatial-summary-island')!.getBoundingClientRect().toJSON(),
			title: el.querySelector('h3')!.getBoundingClientRect().toJSON()
		}));
		expect(boxes.title.x - boxes.panel.x).toBeCloseTo(12, 0);
		expect(
			boxes.panel.y + boxes.panel.height - boxes.title.y - boxes.title.height
		).toBeGreaterThanOrEqual(7);
	});

if (process.env.SPATIAL_GPU) {
	for (const width of [840, 1700])
		test(`Subnavigation fades its shared border without opening a dock gap at ${width}px`, async ({ page }) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/showcase/industrial/wurm-multigate3/?stage-test=1');
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
			await page.evaluate(() => window.__stageVisualTest!.settle(30));
			const breakpoint = await page.evaluate(() => {
				const tabs = document.querySelector('[data-spatial-element-tabs-panel-anchor]')!;
				const header = document.querySelector('[data-spatial-element-sticky-header]')!;
				return tabs.getBoundingClientRect().top + scrollY - header.getBoundingClientRect().bottom;
			});
			for (const offset of [12, 40, 12]) {
				await page.evaluate(y => scrollTo({ top: y, behavior: 'instant' }), breakpoint + offset);
				await page.evaluate(() => window.__stageVisualTest!.settle(30));
				const state = await page.evaluate(() => {
					const tabs = document.querySelector<HTMLElement>('[data-spatial-element-sticky-tabs]')!;
					const header = document.querySelector('[data-spatial-element-sticky-header]')!;
					const edge = getComputedStyle(tabs, '::after');
					return {
						active: tabs.hasAttribute('data-active'),
						gap: tabs.getBoundingClientRect().top - header.getBoundingClientRect().bottom,
						progress: Number(tabs.dataset.spatialElementTabsDockProgress),
						color: edge.borderTopColor,
						width: edge.borderTopWidth,
						radius: parseFloat(getComputedStyle(tabs).borderTopLeftRadius)
					};
				});
				expect(state.active).toBe(true);
				expect(state.gap).toBeCloseTo(0, 1);
				expect(state.width).toBe('1px');
				if (offset === 40) {
					expect(state.progress).toBe(1);
					expect(state.radius).toBe(0);
					expect(state.color).toMatch(/(?:\/ 0|, 0)\)$/);
				} else {
					expect(state.progress).toBeGreaterThan(0);
					expect(state.progress).toBeLessThan(1);
					expect(state.radius).toBeGreaterThan(0);
					expect(state.color).not.toMatch(/(?:\/ 0|, 0)\)$/);
				}
			}
		});
	for (const width of [390, 700])
		test(`Minimap follows thumbnails through intermediate zoom positions at ${width}px`, async ({
			page
		}) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto('/showcase/consumer/logitech-brio-500/?stage-test=1');
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', {
				timeout: 60000
			});
			const read = () =>
				page.evaluate(() => ({
					mini: window.__stageVisualTest!.getMinimapRect()!,
					thumb: document
						.querySelector(
							'[data-spatial-element-media-rail] [data-media-id]:nth-child(2) .stage-panel-surface'
						)!
						.getBoundingClientRect()
						.toJSON()
				}));
			const start = await read();
			for (const zoom of [0.25, 0.35, 0.45, 0.55, 0.8, 0.4, 0]) {
				await page.evaluate((z) => window.__stageVisualTest!.setView({ zoom: z }, 30), zoom);
				const now = await read();
				expect(now.mini.y).toBeCloseTo(
					Math.min(780, start.mini.y + now.thumb.y - start.thumb.y),
					0
				);
			}
		});
	for (const [width, path] of [
		[700, 'industrial/wurm-multigate3'],
		[1700, 'industrial/wurm-multigate3'],
		[1700, 'workbench/kraftform-xxl']
	] as const)
		test(`Dock silhouette is centered and hover stays inside at ${width}px: ${path}`, async ({
			page
		}, info) => {
			await page.setViewportSize({ width, height: 900 });
			await page.goto(`/showcase/${path}/?stage-test=1`);
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', {
				timeout: 60000
			});
			await page.evaluate(() => scrollTo({ top: 1300, behavior: 'instant' }));
			await page.evaluate(() => window.__stageVisualTest!.settle(24));
			const read = () =>
				page.evaluate(() => ({
					model: window.__stageVisualTest!.getMinimapModelRect()!,
					header: document
						.querySelector('[data-spatial-element-sticky-header]')!
						.getBoundingClientRect()
						.toJSON()
				}));
			const initial = await read();
			const check = (state: Awaited<ReturnType<typeof read>>) => {
				expect(state.model.y).toBeCloseTo(
					Math.max(0, state.header.y + (state.header.height - state.model.height) / 2),
					0
				);
				expect(state.model.x).toBeGreaterThanOrEqual(-0.5);
			};
			check(initial);
			await page.mouse.move(
				initial.model.x + initial.model.width / 2,
				initial.model.y + initial.model.height / 2
			);
			await page.evaluate(() => window.__stageVisualTest!.settle(30));
			const hovered = await read();
			check(hovered);
			expect(hovered.model.width).toBeGreaterThan(initial.model.width * 1.01);
			await page.screenshot({ path: info.outputPath('docked-hover.png') });
		});
}
