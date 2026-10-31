import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const destination of ['hero', 'dock']) test(`${destination} retains the real summary through final paint and cleanup`, async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/staged/categories/carousel?stage-test=1&stagedNavigation=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const link = page.locator('[data-carousel-item="column"] .spatial-element-target');
	if (destination === 'hero') await link.evaluate((node: HTMLAnchorElement) => {
		const url = new URL(node.href); url.hash = ''; node.href = url.href;
		node.dataset.catalogView = JSON.stringify({ ...JSON.parse(node.dataset.catalogView!), targetPresentation: 'hero' });
	});
	const field = page.locator('[data-carousel-item="column"] textarea');
	await field.fill('Same edited instance before and after final paint');
	await link.hover();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
	await field.evaluate(node => {
		const source = node as HTMLTextAreaElement;
		const probe = { source, stopped: false,
			samples: [] as { time: number; revealEnded: number; value: string; connected: boolean; sameDestinationNode: boolean; textareaCount: number; phase?: string }[] };
		const sample = () => {
			if (probe.stopped) return;
			const timing = window.__stageVisualTest?.getNavigationTimings().early;
			// For Dock, the synchronous final commit may still be in progress when
			// another RAF first observes revealEnded. Capture its committed node.
			if (timing?.revealEnded && !timing.revealed && !source.closest('[data-catalog-staged-hold]')) {
				probe.samples.push({ time: performance.now(), revealEnded: timing.revealEnded,
					value: source.value, connected: source.isConnected,
					sameDestinationNode: document.querySelector('[data-spatial-element-hero-panel-content] textarea') === source,
					textareaCount: document.querySelectorAll('textarea').length,
					phase: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase });
			}
			requestAnimationFrame(sample);
		};
		Object.assign(window, { cleanupPaintProbe: probe }); requestAnimationFrame(sample);
	});
	await link.click();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0)).toBeGreaterThan(0);
	const result = await page.evaluate(() => {
		const probe = (window as unknown as { cleanupPaintProbe: { source: HTMLTextAreaElement; stopped: boolean; samples: unknown[] } }).cleanupPaintProbe;
		probe.stopped = true;
		return { samples: probe.samples, same: document.querySelector('textarea') === probe.source,
			value: probe.source.value, timings: window.__stageVisualTest!.getNavigationTimings(),
			decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision };
	});
	const path = testInfo.outputPath('final-paint-summary.json');
	await writeFile(path, JSON.stringify(result, null, 2));
	await testInfo.attach('final-paint-summary', { path, contentType: 'application/json' });
	expect(result.decision).toBe('accepted');
	expect(result.samples.length).toBeGreaterThan(0);
	for (const entry of result.samples as { connected: boolean; sameDestinationNode: boolean; textareaCount: number; value: string }[]) {
		expect(entry).toMatchObject({ connected: true, sameDestinationNode: true, textareaCount: 1,
			value: 'Same edited instance before and after final paint' });
	}
	expect(result.same).toBe(true);
	expect(result.value).toBe('Same edited instance before and after final paint');
	expect(errors).toEqual([]);
});
