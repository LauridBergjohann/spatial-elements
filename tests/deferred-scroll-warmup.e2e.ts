import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type { ScrollWarmupCheckpointApi } from '../apps/tests/src/routes/proof/deferred-scroll-warmup/checkpoints';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from './helpers/proofPng';

interface ProofResult {
	error?: string;
	stack?: string;
	protocol: string;
	gpuErrors: string[];
	rows: { used: boolean; sourceDraws: number; stateRestored: boolean; resizeRejected: boolean;
		firstScrollCreates: unknown[]; colorError: number; depthWitnessError: number;
		depthWitnessControl: number; scrollError: number; fullError: number }[];
}

declare global {
	interface Window {
		__deferredScrollWarmupProof?: ProofResult;
		__deferredScrollWarmupCheckpoints?: ScrollWarmupCheckpointApi;
	}
}

test('inactive scroll warming preserves presented Canvas color/depth and prepares the real first Scroll frame', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(String(error)));
	const status = page.locator('[data-scroll-warmup-proof-state]');
	const canvas = page.locator('[data-scroll-warmup-canvas]');
	const names = ['source', 'source-idle', 'after-warm', 'retained', 'candidate-scroll', 'candidate-full', 'reference-scroll', 'reference-full'] as const;
	const domRows: { dpr: number; source: string; target: string; width: number; height: number; maxError: number; spatialRgbRange: number }[] = [];
	await page.goto('/proof/deferred-scroll-warmup');
	try {
		for (const dpr of [1, 1.5]) {
			const screenshots = new Map<string, ReturnType<typeof decodeProofPng>>();
			for (const name of names) {
				await expect.poll(() => page.evaluate(({ name, dpr }) => {
					if (document.querySelector('[data-scroll-warmup-proof-state]')?.getAttribute('data-scroll-warmup-proof-state') === 'error') return 'error';
					const point = window.__deferredScrollWarmupCheckpoints?.getCurrent();
					return point?.name === name && point.dpr === dpr ? 'checkpoint' : 'waiting';
				}, { name, dpr }), { timeout: 90000 }).not.toBe('waiting');
				const failure = await page.evaluate(() => window.__deferredScrollWarmupProof?.error);
				expect(failure).toBeUndefined();
				const point = await page.evaluate(() => window.__deferredScrollWarmupCheckpoints!.getCurrent()!);
				expect(point).toMatchObject({ name, dpr });
				const png = await canvas.screenshot();
				await writeFile(info.outputPath(`dpr-${dpr}-${name}.png`), png);
				const pixels = decodeProofPng(png);
				screenshots.set(name, pixels);
				if (name === 'source') expect(proofPngRgbRange(pixels), 'Presented source must be spatially nonuniform before warming').toBeGreaterThan(40);
				expect(await page.evaluate(id => window.__deferredScrollWarmupCheckpoints!.release(id), point.id)).toBe(true);
			}
			for (const [source, target] of [
				['source', 'source-idle'], ['source', 'after-warm'], ['source', 'retained'],
				['candidate-scroll', 'reference-scroll'], ['candidate-full', 'reference-full']
			]) {
				const left = screenshots.get(source)!, right = screenshots.get(target)!;
				domRows.push({ dpr, source, target, width: left.width, height: left.height,
					maxError: proofPngDifference(left, right), spatialRgbRange: proofPngRgbRange(left) });
			}
		}
		await expect(status).toHaveAttribute('data-scroll-warmup-proof-state', /^(ready|error)$/, { timeout: 90000 });
		const proof = await page.evaluate(() => window.__deferredScrollWarmupProof!);
		expect(proof.error, proof.stack ?? proof.error).toBeUndefined();
		expect(proof.protocol).toBe('offscreen-scroll-warmup-v3-dom-checkpoints');
		expect(errors).toEqual([]); expect(proof.gpuErrors).toEqual([]); expect(proof.rows).toHaveLength(2);
		for (const row of proof.rows) {
			expect(row.used, JSON.stringify(row)).toBe(true); expect(row.sourceDraws).toBe(1);
			expect(row.stateRestored).toBe(true); expect(row.resizeRejected).toBe(true);
			expect(row.firstScrollCreates).toEqual([]);
			for (const key of ['colorError', 'depthWitnessError', 'scrollError', 'fullError'] as const)
				expect(row[key], `${key}: ${JSON.stringify(row)}`).toBe(0);
			expect(row.depthWitnessControl).toBeGreaterThan(0.1);
		}
		expect(domRows).toHaveLength(10);
		for (const row of domRows) {
			expect(row.spatialRgbRange, JSON.stringify(row)).toBeGreaterThan(40);
			expect(row.maxError, JSON.stringify(row)).toBe(0);
		}
	} finally {
		const proof = await page.evaluate(() => window.__deferredScrollWarmupProof ?? {
			error: 'Fixture did not complete', checkpoint: window.__deferredScrollWarmupCheckpoints?.getCurrent()
		}).catch(error => ({ error: String(error) }));
		await writeFile(info.outputPath('deferred-scroll-warmup-pixels.json'), JSON.stringify({ proof, domRows, pageErrors: errors }, null, 2));
	}
});
