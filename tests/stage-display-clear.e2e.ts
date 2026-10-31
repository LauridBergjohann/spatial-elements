import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('StageDisplay combines only its controlled clear with an identical Canvas output', async ({ page }, testInfo) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(String(error)));
	await page.goto('/proof/stage-display-clear');
	await expect(page.locator('[data-stage-display-proof-state]')).toHaveAttribute('data-stage-display-proof-state', 'ready', { timeout: 60000 });
	const proof = await page.evaluate(() => (window as unknown as { __stageDisplayClearProof: {
		gpuErrors: string[]; linearReadback: string;
		rows: { mode: string; halo: boolean; panel: boolean; maxLinearError: number; maxCanvasError: number;
			referenceSubmits: number; candidateSubmits: number; flagsRestored: boolean; pixelRange: number; panelDifference: number }[];
	} }).__stageDisplayClearProof);
	await writeFile(testInfo.outputPath('stage-display-clear-pixels.json'), JSON.stringify(proof, null, 2));
	expect(errors).toEqual([]);
	expect(proof.gpuErrors).toEqual([]);
	expect(proof.linearReadback).toBe('RGBA/HalfFloat/Uint16Array');
	expect(proof.rows).toHaveLength(24);
	for (const row of proof.rows) {
		// Same shader/samples/output transform: the pass merger must be pixel-exact.
		expect(row.maxLinearError, JSON.stringify(row)).toBe(0);
		expect(row.maxCanvasError, JSON.stringify(row)).toBe(0);
		expect(row.flagsRestored).toBe(true);
		expect(row.pixelRange).toBeGreaterThan(40);
		if (row.panel && row.mode !== 'clear-depth') expect(row.panelDifference).toBeGreaterThan(10);
		if (['first', 'repeat', 'resize-dpr'].includes(row.mode))
			expect(row.candidateSubmits, JSON.stringify(row)).toBeLessThan(row.referenceSubmits);
		else expect(row.candidateSubmits, JSON.stringify(row)).toBe(row.referenceSubmits);
	}
});
