import { expect, test } from '@playwright/test';

for (const width of [600, 700, 2400]) test(`Summary columns follow the available panel width at ${width}px`, async ({ page }) => {
	await page.setViewportSize({ width, height: 900 });
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	for (const path of ['consumer/logitech-z407', 'workbench/kraftform-kompakt', 'exclusive/chronograph', 'industrial/item-profile', 'industrial/wurm-asv101']) {
		await page.goto(`/showcase/${path}/`);
		const summary = page.locator('.summary-presentation');
		await expect(summary).toBeVisible();
		const boxes = await summary.evaluate(root => {
			const features = root.querySelector('.feature-list')!;
			const action = root.querySelector('[data-catalog-rich-shared="primary-action"]')!;
			return { columns: getComputedStyle(features).gridTemplateColumns.split(' ').length,
				width: root.getBoundingClientRect().width, action: action.getBoundingClientRect().width };
		});
		expect(boxes.columns).toBe(2);
		expect(boxes.action).toBeLessThan(boxes.width * 0.6);
	}
});

if (process.env.SPATIAL_GPU) for (const width of [390, 700]) test(`Minimap stays with its panel during scroll and zoom at ${width}px`, async ({ page }, info) => {
	await page.setViewportSize({ width, height: 900 });
	await page.goto('/showcase/consumer/logitech-ergo-k860/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	const read = () => page.evaluate(() => {
		const api = window.__stageVisualTest!;
		const panel = api.getMinimapRect()!, model = api.getMinimapModelRect()!;
		return { panel, model, relativeY: (model.y + model.height / 2 - panel.y) / panel.height,
			progress: api.getMinimapOrientation()!.dockProgress };
	});
	const start = await read();
	for (const scroll of [100, 260, 100, 0]) {
		await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), scroll);
		await expect.poll(async () => Math.abs((await read()).panel.y - (start.panel.y - scroll))).toBeLessThan(1);
		const current = await read();
		expect(current.progress).toBe(0);
		expect(Math.abs(current.relativeY - start.relativeY)).toBeLessThan(0.02);
	}
	const header = page.locator('[data-spatial-element-sticky-header]');
	await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), start.panel.y + 40);
	await expect.poll(async () => (await read()).progress).toBeGreaterThan(0.3);
	await expect.poll(async () => (await read()).progress).toBeLessThan(0.7);
	await page.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), start.panel.y + 80);
	await expect.poll(async () => (await read()).progress).toBe(1);
	await expect(header.locator('.sticky-header-kicker')).toBeVisible();
	await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
	await page.evaluate(() => window.__stageVisualTest!.settle(12));
	const origins = await page.evaluate(() => ({
		thumb: document.querySelector('[data-spatial-element-media-rail] [data-media-id]:nth-child(2) .stage-panel-surface')!.getBoundingClientRect().toJSON(),
		summary: document.querySelector('[data-spatial-element-hero-panel-content]')!.getBoundingClientRect().toJSON(),
		breadcrumb: document.querySelector('.spatial-element-pane-heading .breadcrumbs')!.getBoundingClientRect().toJSON()
	}));
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45 }, 24));
	const current = await read();
	const moved = await page.evaluate(() => ({
		thumb: document.querySelector('[data-spatial-element-media-rail] [data-media-id]:nth-child(2) .stage-panel-surface')!.getBoundingClientRect().toJSON(),
		summary: document.querySelector('[data-spatial-element-hero-panel-content]')!.getBoundingClientRect().toJSON(),
		breadcrumb: document.querySelector('.spatial-element-pane-heading .breadcrumbs')!.getBoundingClientRect().toJSON(),
		clip: getComputedStyle(document.querySelector('[data-spatial-element-media-rail]')!).overflowY
	}));
	const delta = moved.thumb.y - origins.thumb.y;
	expect(delta).toBeGreaterThan(5);
	expect(moved.breadcrumb.y).toBeLessThan(origins.breadcrumb.y - 5);
	expect(Math.abs(delta - (moved.summary.y - origins.summary.y))).toBeLessThan(2);
	expect(Math.abs(moved.thumb.x - origins.thumb.x)).toBeLessThan(1);
	expect(moved.clip).toBe('visible');
	expect(current.model.y + current.model.height / 2).toBeGreaterThan(current.panel.y);
	expect(current.model.y + current.model.height / 2).toBeLessThan(current.panel.y + current.panel.height);
	await page.screenshot({ path: info.outputPath(`zoom-${width}.png`) });
});
