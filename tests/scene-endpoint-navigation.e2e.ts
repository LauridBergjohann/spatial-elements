import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

// Functional hit evidence only. This diagnostic sampler is deliberately separate from latency/performance cohorts.
for (const view of ['list', 'carousel']) test(`${view} uses ready scene endpoints during the actual Hero reveal`, async ({ page }, testInfo) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	await page.goto(`/demo/categories/${view}?stage-test=1&stagedNavigation=1`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
		: page.locator('[data-carousel-item="column"] .spatial-element-target');
	await link.hover();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
	// This cache requires available High. The separate performance harness keeps its original readiness rules.
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCatalogPresentation()?.preparation?.high)).toBe('ready');
	await page.evaluate(() => {
		const probe = { frames: [] as unknown[], stopped: false };
		Object.assign(window, { sceneEndpointNavigationProbe: probe });
		const deadline = performance.now() + 30000;
		const sample = () => {
			const api = window.__stageVisualTest;
			const phase = document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase;
			const presentation = api?.getCatalogPresentation();
			if (phase) probe.frames.push({ time: performance.now(), phase,
				state: presentation?.representations.state, cache: presentation?.representations.sceneEndpointCache ?? [] });
			if ((api?.getNavigationTimings().early?.revealed ?? 0) > 0 || performance.now() > deadline) { probe.stopped = true; return; }
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
	await link.click();
	await expect.poll(() => page.evaluate(() => (window as any).sceneEndpointNavigationProbe.stopped)).toBe(true);
	const report = await page.evaluate(() => ({ ...(window as any).sceneEndpointNavigationProbe,
		timings: window.__stageVisualTest?.getNavigationTimings(),
		decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision,
		error: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedError,
		final: window.__stageVisualTest?.getCatalogPresentation() }));
	const path = testInfo.outputPath('scene-endpoint-navigation.json');
	await writeFile(path, JSON.stringify({ runtime: process.env.SCENE_ENDPOINT_RUNTIME ?? 'not-declared', build: process.env.SCENE_ENDPOINT_BUILD ?? 'not-declared', view, ...report }, null, 2));
	await testInfo.attach('scene-endpoint-navigation.json', { path, contentType: 'application/json' });
	expect(errors).toEqual([]);
	expect(report.timings?.early?.revealed, JSON.stringify({ decision: report.decision, error: report.error })).toBeGreaterThan(0);
	const visibleHits = report.frames.filter((frame: any) => frame.phase === 'revealing' && frame.cache.some((cache: any) => cache.ready > 0 && cache.hits > 0));
	expect(visibleHits.length, JSON.stringify(report.frames)).toBeGreaterThan(0);
	await expect(page.locator('[data-spatial-element-root]')).toBeVisible();
});
