import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from './helpers/proofPng';
import type { BackgroundCheckpointApi } from '../apps/sveltekit-demo/src/routes/proof/background-layer-output/checkpoints';
import type { CatalogWarmEvidence, CatalogWarmRow, WarmGpuCall } from '../apps/sveltekit-demo/src/routes/proof/catalog-warm-output/proof';

interface WarmProofResult { protocol: string; rows: CatalogWarmRow[]; calls: WarmGpuCall[]; gpuErrors: string[]; limits: string[]; error?: string; stack?: string }
declare global {
	interface Window { __catalogWarmOutputProof?: WarmProofResult; __catalogWarmOutputCheckpoints?: BackgroundCheckpointApi; __catalogWarmOutputEvidence?: CatalogWarmEvidence }
}

test('real catalog scratch preparation preserves Background and prepares first Focus/Moving owners', async ({ page }, info) => {
	const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(String(error)));
	const domRows: { kind: string; phase: string; width: number; height: number; maxError: number; sourceRgbRange: number }[] = [];
	await page.goto('/proof/catalog-warm-output');
	try {
		for (const kind of ['list', 'frosted', 'glass']) {
			let source: ReturnType<typeof decodeProofPng> | undefined;
			for (const phase of ['source', 'source-idle', 'after-warm', 'after-high']) {
				await page.waitForFunction(name => {
					const terminal = document.querySelector('[data-catalog-warm-proof-state]')?.getAttribute('data-catalog-warm-proof-state');
					return terminal === 'error' || terminal === 'ready' || window.__catalogWarmOutputCheckpoints?.getCurrent()?.phase === name;
				}, `${kind}/${phase}`, { timeout: 90000 });
				const failure = await page.evaluate(() => window.__catalogWarmOutputProof?.error);
				expect(failure).toBeUndefined();
				const point = await page.evaluate(() => window.__catalogWarmOutputCheckpoints?.getCurrent());
				expect(point?.phase).toBe(`${kind}/${phase}`);
				const canvas = page.locator('[data-catalog-warm-canvas="background"]');
				const rect = await canvas.boundingBox();
				expect(rect).toEqual({ x: 8, y: 8, width: 240, height: 160 });
				const png = await canvas.screenshot(); await writeFile(info.outputPath(`${kind}-${phase}.png`), png);
				const decoded = decodeProofPng(png); source ??= decoded;
				domRows.push({ kind, phase, width: decoded.width, height: decoded.height,
					maxError: proofPngDifference(source, decoded), sourceRgbRange: proofPngRgbRange(source) });
				await writeFile(info.outputPath('background-checkpoints.json'), JSON.stringify(domRows, null, 2));
				expect(proofPngRgbRange(source), 'The actual presented Background must be nonuniform before warming').toBeGreaterThan(40);
				expect(await page.evaluate(id => window.__catalogWarmOutputCheckpoints!.release(id), point!.id)).toBe(true);
			}
		}
		await expect(page.locator('[data-catalog-warm-proof-state]')).toHaveAttribute('data-catalog-warm-proof-state', /^(ready|error)$/, { timeout: 90000 });
		const proof = await page.evaluate(() => window.__catalogWarmOutputProof!);
		expect(proof.error, proof.stack ?? proof.error).toBeUndefined();
		expect(proof.protocol).toBe('catalog-warm-output-v1'); expect(proof.rows).toHaveLength(3);
		expect(pageErrors).toEqual([]); expect(proof.gpuErrors).toEqual([]);
		for (const row of proof.rows) {
			expect(row.actors).toBe(row.kind === 'list' ? 1 : 2);
			expect(row.initialReady, JSON.stringify(row)).toBe(false); expect(row.readyBeforeFence).toBe(false);
			expect(row.readyAfterFence, JSON.stringify(row)).toBe(true); expect(row.legacyReadyAfterScratch).toBe(false);
			expect(row.stateRestoredSynchronously).toBe(true); expect(row.scratchStateRestored).toBe(true);
			expect(row.backgroundImplicitBefore).toBe(false); expect(row.backgroundImplicitAfter).toBe(false);
			expect(row.scratchDistinct).toBe(true); expect(row.warmCreates).toBeGreaterThan(0);
			expect(row.focusObserved).toEqual([true, true]); expect(row.captureAccepted).toEqual([true, true]);
			for (const key of ['firstFocusCreates', 'firstMovingCreates', 'afterHighFocusCreates', 'afterHighMovingCreates'] as const)
				expect(row[key], `${row.kind}/${key}`).toEqual([]);
			expect(row.staleFenceRejected).toBe(true); expect(row.resizeRejected).toBe(true); expect(row.resizedBackStillRejected).toBe(true);
		}
		for (const row of domRows) {
			expect(row.width).toBe(240); expect(row.height).toBe(160); expect(row.maxError, JSON.stringify(row)).toBe(0);
		}
	} finally {
		const proof = await page.evaluate(() => window.__catalogWarmOutputProof ?? {
			error: 'Fixture did not complete', checkpoint: window.__catalogWarmOutputCheckpoints?.getCurrent(), evidence: window.__catalogWarmOutputEvidence
		}).catch(error => ({ error: String(error) }));
		await writeFile(info.outputPath('catalog-warm-output.json'), JSON.stringify({ proof, domRows, pageErrors }, null, 2));
	}
});
