import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('inactive scroll warming preserves Canvas color/depth and prepares the real first Scroll frame', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(String(error)));
	await page.goto('/proof/deferred-scroll-warmup');
	await expect(page.locator('[data-scroll-warmup-proof-state]')).toHaveAttribute('data-scroll-warmup-proof-state', 'ready', { timeout: 90000 });
	const proof = await page.evaluate(() => (window as unknown as { __deferredScrollWarmupProof: {
		gpuErrors: string[]; rows: { used: boolean; sourceDraws: number; stateRestored: boolean; resizeRejected: boolean;
			firstScrollCreates: unknown[]; pixelRange: number; colorError: number; canvasError: number; depthWitnessError: number;
			depthWitnessControl: number; scrollError: number; scrollCanvasError: number; fullError: number; fullCanvasError: number }[];
	} }).__deferredScrollWarmupProof);
	await writeFile(info.outputPath('deferred-scroll-warmup-pixels.json'), JSON.stringify(proof, null, 2));
	expect(errors).toEqual([]); expect(proof.gpuErrors).toEqual([]); expect(proof.rows).toHaveLength(2);
	for (const row of proof.rows) {
		expect(row.used, JSON.stringify(row)).toBe(true); expect(row.sourceDraws).toBe(1);
		expect(row.stateRestored).toBe(true); expect(row.resizeRejected).toBe(true);
		expect(row.firstScrollCreates).toEqual([]); expect(row.pixelRange).toBeGreaterThan(40);
		for (const key of ['colorError', 'canvasError', 'depthWitnessError', 'scrollError', 'scrollCanvasError', 'fullError', 'fullCanvasError'] as const)
			expect(row[key], `${key}: ${JSON.stringify(row)}`).toBe(0);
		expect(row.depthWitnessControl).toBeGreaterThan(0.1);
	}
});
