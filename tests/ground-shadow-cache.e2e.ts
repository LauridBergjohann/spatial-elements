import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('separate cached Ground silhouettes preserve overlapping fades and invalidate changed projections', async ({ page }, testInfo) => {
	await page.goto('/proof/ground-shadow-cache');
	await expect(page.locator('[data-ground-proof-state]')).toHaveAttribute('data-ground-proof-state', 'ready', { timeout: 60000 });
	const proof = await page.evaluate(() => (window as unknown as { __groundCacheProof: {
		rows: { format: string; opacity: number; maxError: number; cacheDraws: number; liveDraws: number }[];
		mutations: { kind: string; maxError: number; cacheDraws: number; liveDraws: number }[];
		scissorRows: { format: string; maxError: number; restored: boolean }[];
		overlapPixels: number; incorrectMergedFadeError: number;
	} }).__groundCacheProof);
	await writeFile(testInfo.outputPath('ground-cache-pixel-proof.json'), JSON.stringify(proof, null, 2));
	await testInfo.attach('ground-cache-pixel-proof', { body: JSON.stringify(proof, null, 2), contentType: 'application/json' });
	expect(proof.rows).toHaveLength(12);
	expect(proof.overlapPixels).toBeGreaterThan(100);
	// This scene detects the incorrect merged-snapshot shortcut, rather than testing disjoint shadows.
	expect(proof.incorrectMergedFadeError).toBeGreaterThan(0.002);
	for (const row of proof.rows) {
		// Predeclared storage-rounding bounds: two half-float ULPs below 1, or one RGBA8 step.
		expect(row.maxError, JSON.stringify(row)).toBeLessThanOrEqual(row.format === 'rgba16float' ? 1 / 1024 : 1 / 255 + 1e-12);
		expect(row.liveDraws).toBe(0);
		expect(row.cacheDraws).toBe(row.opacity ? 2 : 0);
	}
	expect(proof.mutations.map(row => [row.kind, row.cacheDraws, row.liveDraws])).toEqual([['pose', 1, 1], ['camera', 0, 2]]);
	for (const row of proof.mutations) expect(row.maxError).toBeLessThanOrEqual(1 / 255 + 1e-12);
	expect(proof.scissorRows).toHaveLength(2);
	for (const row of proof.scissorRows) {
		expect(row.restored).toBe(true);
		expect(row.maxError).toBeLessThanOrEqual(row.format === 'rgba16float' ? 1 / 1024 : 1 / 255 + 1e-12);
	}
});
