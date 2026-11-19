import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import { resolveSpatialElementDockLayout } from '../../packages/core/src/spatial-element/spatialElementDock';

if (process.env.SPATIAL_GPU) for (const [width, product] of [
	[390, 'exclusive/chronograph'], [740, 'consumer/logitech-ergo-k860'], [700, 'exclusive/chronograph'],
	[1920, 'workbench/kraftform-kompakt'], [2100, 'exclusive/chronograph']
] as const) test(`showcase dock continuity: ${product} at ${width}px`, async ({ page }) => {
	await page.setViewportSize({ width, height: 900 });
	await page.goto(`/showcase/${product}/?stage-test=1`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	const dockTop = resolveSpatialElementDockLayout({ width, height: 900 })!.minimap.top;
	const result = await page.evaluate(async dockTop => {
		const api = window.__stageVisualTest!;
		await api.settle(20);
		const initial = api.getMinimapRect()!;
		const top = initial.y - dockTop;
		const frames = [];
		const positions = Array.from({ length: Math.ceil((initial.height + 80) / 4) }, (_, i) => Math.max(0, top - 40 + i * 4));
		scrollTo({ top: positions[0], behavior: 'instant' });
		// Let the browser dispatch the initial native scroll before measuring;
		// settle() alone advances GPU frames, not the browser's scroll timeline.
		for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
		await api.settle(12);
		// Include the entire morph AND the old 16px release band. Record every
		// animation frame; settling each sample used to conceal transient jumps.
		for (const y of [...positions, ...positions.toReversed()]) {
			scrollTo({ top: y, behavior: 'instant' });
			for (let i = 0; i < 3; i++) {
				await new Promise(requestAnimationFrame);
				frames.push({ rect: api.getMinimapModelRect(), visible: api.getVisibilityStats().visibleMinimaps });
			}
		}
		return frames;
	}, dockTop);
	for (let i = 0; i < result.length; i++) {
		expect(result[i].visible).toBe(1);
		expect(result[i].rect).not.toBeNull();
		if (!i) continue;
		expect(Math.abs(result[i].rect!.y - result[i - 1].rect!.y), `frame ${i}`).toBeLessThan(9);
		expect(Math.abs(result[i].rect!.height - result[i - 1].rect!.height), `frame ${i}`).toBeLessThan(9);
	}
});

if (process.env.SPATIAL_GPU) test('glass header conceals breadcrumbs and dock never cuts departing copy or pictures', async ({ page }) => {
	await page.setViewportSize({ width: 740, height: 900 });
	await page.goto('/showcase/exclusive/chronograph/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	await page.evaluate(async () => {
		scrollTo(0, 24);
		for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
		await window.__stageVisualTest!.settle(20);
	});
	const mask = await page.locator('.breadcrumbs').first().evaluate(el => getComputedStyle(el).maskImage);
	expect(mask).toContain('linear-gradient');
	await page.goto('/showcase/consumer/logitech-ergo-k860/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	const states = await page.evaluate(async () => {
		const api = window.__stageVisualTest!;
		await api.settle(20);
		const initial = api.getMinimapRect()!;
		const result = [];
		for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
			scrollTo(0, initial.y + initial.height * fraction);
			for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
			await api.settle(6);
			result.push([...document.querySelectorAll<HTMLElement>('[data-spatial-element-hero-panel-content], [data-spatial-element-departing-media-content]')]
				.map(el => ({ clip: getComputedStyle(el).clipPath, mask: el.style.maskImage })));
		}
		return result;
	});
	for (const state of states.flat()) expect(state.clip).toBe('none');
	expect(states.flat().some(state => state.mask.includes('linear-gradient'))).toBe(true);
});
