import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const width of [430, 2456]) test.describe(`${width}px actual navigation motion`, () => {
	test.use({ viewport: { width, height: width === 430 ? 820 : 1000 }, hasTouch: width === 430, isMobile: width === 430 });
	for (const view of ['list', 'carousel'] as const) for (const staged of [false, true]) {
		test(`${view} ${staged ? 'staged' : 'ordinary'} animates forward and history return`, async ({ page }, testInfo) => {
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			const url = `/demo/categories/${view}?stage-test=1${staged ? '&stagedNavigation=1' : ''}`;
			await page.goto(url);
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
			const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
				: page.locator('[data-carousel-item="column"] .information').first();
			await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
			if (staged) await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady))).toBe(true);
			await page.evaluate(() => {
				const frames: { phase: string; recipe?: string; direction?: string }[] = [];
				Object.assign(window, { responsiveTransitionFrames: frames });
				const sample = () => {
					const root = document.querySelector<HTMLElement>('.stage');
					const phase = root?.dataset.catalogStagedPhase ?? root?.dataset.catalogTransition;
					if (phase) frames.push({ phase, recipe: root?.dataset.catalogRecipe, direction: root?.dataset.catalogDirection });
					requestAnimationFrame(sample);
				};
				requestAnimationFrame(sample);
			});
			// No desktop hover: touch devices must animate a normal tap on a rendered model.
			if (width === 430) await link.tap(); else await link.click();
			await expect(page).toHaveURL(/\/demo\/elements\/column$/);
			await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCatalogPresentation()?.representations.state)).toBe('high');
			await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
			await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
			const forward = await page.evaluate(() => (window as unknown as { responsiveTransitionFrames: { phase: string }[] }).responsiveTransitionFrames.splice(0));
			await testInfo.attach('forward-frames', { body: JSON.stringify(forward), contentType: 'application/json' });
			const forwardDiagnostic = await page.evaluate(() => ({
				decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogTransitionDecision,
				stagedDecision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision,
				endpoints: window.__stageVisualTest!.getCatalogEndpoints(),
				timings: window.__stageVisualTest!.getNavigationTimings()
			}));
			await testInfo.attach('forward-diagnostic', { body: JSON.stringify(forwardDiagnostic), contentType: 'application/json' });
			expect(forward.filter(frame => frame.phase === (staged ? 'moving' : 'animating')).length, JSON.stringify(forwardDiagnostic)).toBeGreaterThan(2);
			await page.goBack();
			await expect(page).toHaveURL(new URL(url, page.url()).href);
			await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
			await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
			const backward = await page.evaluate(() => (window as unknown as { responsiveTransitionFrames: { phase: string; direction?: string }[] }).responsiveTransitionFrames);
			await testInfo.attach('return-frames', { body: JSON.stringify(backward), contentType: 'application/json' });
			const diagnostic = await page.evaluate(() => ({
				decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogTransitionDecision,
				endpoints: window.__stageVisualTest!.getCatalogEndpoints(),
				actors: window.__stageVisualTest!.getCarouselStats(),
				timings: window.__stageVisualTest!.getNavigationTimings()
			}));
			await testInfo.attach('return-diagnostic', { body: JSON.stringify(diagnostic), contentType: 'application/json' });
			expect(backward.filter(frame => frame.phase === 'animating' && frame.direction === 'return').length, JSON.stringify(diagnostic)).toBeGreaterThan(2);
			expect(errors).toEqual([]);
		});
	}
});
