import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('four linear scene endpoints reproduce interior real scene/refinement renders', async ({ page }, testInfo) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
	const control = process.env.SCENE_ENDPOINT_CONTROL === 'single';
	const runtimeCache = process.env.SCENE_ENDPOINT_CACHE === 'runtime';
	const query = new URLSearchParams();
	if (control) query.set('coverPremultiplication', 'single');
	if (runtimeCache) query.set('cache', 'runtime');
	await page.goto(`/?${query}`);
	await page.waitForFunction(() => Boolean((window as any).__sceneEndpointProof));
	const report = await page.evaluate(() => (window as any).__sceneEndpointProof.run());
	report.runtimeRevision = process.env.SCENE_ENDPOINT_RUNTIME ?? 'not-declared';
	report.runtimeBuild = process.env.SCENE_ENDPOINT_BUILD ?? 'not-declared';
	const reportPath = testInfo.outputPath('scene-endpoint-pixels.json');
	await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
	await testInfo.attach('scene-endpoint-pixels.json', { path: reportPath, contentType: 'application/json' });
	console.log(JSON.stringify(report.results.map((r: any) => ({ kind: r.kind,
		maxLinear: Math.max(...r.samples.map((s: any) => s.comparison.maxError)),
		maxToleranceRatio: Math.max(...r.samples.map((s: any) => s.comparison.maxToleranceRatio)),
		maxEightBitLevels: Math.max(...r.samples.map((s: any) => s.displayDifference.maxEightBitLevels)),
		repeatMax: Math.max(...r.samples.map((s: any) => s.repeatedReference.maxError)) }))));
	expect(errors).toEqual([]);
	expect(report.productionCacheEnabled).toBe(false);
	expect(report.control).toBe(control ? 'fixture-only-single-background-cover-premultiplication' : 'unmodified-production-renderer');
	expect(report.backend).toBe('webgpu');
	expect(report.results.map((r: any) => r.kind)).toEqual(['opaque', 'transparent', 'rough-transmission', 'nested-transmission']);
	for (const result of report.results) {
		if (runtimeCache) {
			expect(result.fixtureExtraTargetCount).toBe(0);
			expect(result.runtimeCacheStats).toMatchObject({ preparations: result.samples.length, ready: result.samples.length, hits: result.samples.length, active: false, pending: false });
		}
		expect(result.additionalTargets).toHaveLength(2);
		for (const target of result.additionalTargets) expect(target).toMatchObject({ halfFloat: true, samples: 0, depthBuffer: false, stencilBuffer: false });
		expect(result.capturesPreservedState, `${result.kind}: capture must not tick q or change scene/pose`).toBe(true);
		expect(result.endpointControlsPass, `${result.kind}: endpoint/copy controls`).toBe(true);
		for (const sample of result.samples) {
			expect(sample.seedPreservation.maxError, `${result.kind}: preparation must preserve the real destination seed exactly`).toBe(0);
			expect(sample.repeatedReference.equivalent, `${result.kind}: real-render stability ${JSON.stringify(sample)}`).toBe(true);
			expect(sample.comparison.equivalent, `${result.kind}: bilinear equivalence ${JSON.stringify(sample)}`).toBe(true);
		}
	}
});
