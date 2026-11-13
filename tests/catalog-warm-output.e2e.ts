import { expect, test } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from './helpers/proofPng';
import type { BackgroundCheckpointApi } from '../apps/tests/src/routes/proof/background-layer-output/checkpoints';
import type { CatalogWarmMode, CatalogWarmEvidence, CatalogWarmRow, WarmGpuCall } from '../apps/tests/src/routes/proof/catalog-warm-output/proof';

interface WarmProofResult { protocol: string; warmMode: CatalogWarmMode; rows: CatalogWarmRow[]; calls: WarmGpuCall[]; gpuErrors: string[]; limits: string[]; error?: string; stack?: string }
declare global {
	interface Window { __catalogWarmOutputProof?: WarmProofResult; __catalogWarmOutputCheckpoints?: BackgroundCheckpointApi; __catalogWarmOutputEvidence?: CatalogWarmEvidence }
}
test.describe.configure({ mode: 'serial' });

for (const warmMode of ['scratch', 'legacy', 'borrowed'] as const) test(`real catalog ${warmMode} preparation prepares first Focus/Moving owners`, async ({ page }, info) => {
	const pageErrors: string[] = []; page.on('pageerror', error => pageErrors.push(String(error)));
	const domRows: { kind: string; phase: string; width: number; height: number; maxError: number; sourceRgbRange: number }[] = [];
	await page.goto(`/proof/catalog-warm-output?warm-mode=${warmMode}`);
	try {
		for (const kind of ['list', 'frosted', 'glass']) {
			let source: ReturnType<typeof decodeProofPng> | undefined;
			for (const phase of ['source', 'source-idle', 'after-warm', 'first/focus', 'first/moving', 'after-high', 'after-high/focus', 'after-high/moving']) {
				await page.waitForFunction(name => {
					const terminal = document.querySelector('[data-catalog-warm-proof-state]')?.getAttribute('data-catalog-warm-proof-state');
					return terminal === 'error' || terminal === 'ready' || window.__catalogWarmOutputCheckpoints?.getCurrent()?.phase === name;
				}, `${kind}/${phase}`, { timeout: 90000 });
				const failure = await page.evaluate(() => window.__catalogWarmOutputProof?.error);
				expect(failure).toBeUndefined();
				const point = await page.evaluate(() => window.__catalogWarmOutputCheckpoints?.getCurrent());
				expect(point?.phase).toBe(`${kind}/${phase}`);
				if (phase.includes('/')) {
					// Composite scene screenshot: the live Rear/Foreground canvases plus their
					// real DOM overlays, taken before any restore or subsequent layer draw.
					const scene = page.locator('[data-catalog-warm-canvas="front"]');
					expect(await scene.boundingBox()).toEqual({ x: 0, y: 0, width: 960, height: 640 });
					// The independent retained-Background preview is a different contract:
					// legacy Canvas warmup may replace it. Hide only that diagnostic overlay
					// and status while retaining the complete productive scene bounds.
					await writeFile(info.outputPath(`${kind}-${phase.replace('/', '-')}-scene.png`), await scene.screenshot({
						style: '[data-catalog-warm-canvas="background"], .status { visibility: hidden !important; }'
					}));
					expect(await page.evaluate(id => window.__catalogWarmOutputCheckpoints!.release(id), point!.id)).toBe(true);
					continue;
				}
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
		expect(proof.protocol).toBe('catalog-warm-output-v1'); expect(proof.warmMode).toBe(warmMode); expect(proof.rows).toHaveLength(3);
		expect(pageErrors).toEqual([]); expect(proof.gpuErrors).toEqual([]);
		for (const row of proof.rows) {
			expect(row.actors).toBe(row.kind === 'list' ? 1 : 2);
			expect(row.initialReady, JSON.stringify(row)).toBe(false); expect(row.readyBeforeFence).toBe(false);
			expect(row.readyAfterFence, JSON.stringify(row)).toBe(true); expect(row.legacyReadyAfterScratch).toBe(warmMode === 'legacy');
			expect(row.stateRestoredSynchronously).toBe(true); expect(row.scratchStateRestored).toBe(true);
			if (warmMode !== 'legacy') expect(row.backgroundImplicitBefore).toBe(false);
			expect(row.backgroundImplicitAfter).toBe(warmMode === 'legacy');
			expect(row.sharedOwnerTarget).toBe(warmMode === 'borrowed' ? true : null);
			expect(row.scratchPublicationRejected).toBe(warmMode === 'borrowed' ? true : null);
			expect(row.scratchDistinct).toBe(true); expect(row.warmCreates).toBeGreaterThan(0);
			expect(row.focusObserved).toEqual([true, true]); expect(row.captureAccepted).toEqual([true, true]);
			for (const key of ['firstFocusCreates', 'firstMovingCreates', 'afterHighFocusCreates', 'afterHighMovingCreates'] as const)
				expect(row[key], `${row.kind}/${key}`).toEqual([]);
			expect(row.staleFenceRejected).toBe(true); expect(row.resizeRejected).toBe(true); expect(row.resizedBackStillRejected).toBe(true);
		}
		for (const row of domRows) {
			expect(row.width).toBe(240); expect(row.height).toBe(160);
			// Exact retention remains mandatory for scratch. The separate legacy control
			// measures first-use resources and records its Canvas pixels without certifying retention.
			if (warmMode !== 'legacy') expect(row.maxError, JSON.stringify(row)).toBe(0);
		}
	} finally {
		const proof = await page.evaluate(() => window.__catalogWarmOutputProof ?? {
			error: 'Fixture did not complete', checkpoint: window.__catalogWarmOutputCheckpoints?.getCurrent(), evidence: window.__catalogWarmOutputEvidence
		}).catch(error => ({ error: String(error) }));
		await writeFile(info.outputPath('catalog-warm-output.json'), JSON.stringify({ proof, domRows, pageErrors }, null, 2));
	}
});

test('both offscreen modes preserve the legacy productive scene pixels', async ({}, info) => {
	const directories = await readdir(info.project.outputDir, { withFileTypes: true });
	const modes = new Map<string, string>();
	for (const entry of directories) {
		if (!entry.isDirectory()) continue;
		const dir = join(info.project.outputDir, entry.name);
		const raw = await readFile(join(dir, 'catalog-warm-output.json'), 'utf8').catch(() => null);
		if (!raw) continue;
		const { proof } = JSON.parse(raw) as { proof: WarmProofResult };
		if (proof.warmMode) modes.set(proof.warmMode, dir);
	}
	expect([...modes.keys()].sort()).toEqual(['borrowed', 'legacy', 'scratch']);
	const rows = [];
	for (const kind of ['list', 'frosted', 'glass']) {
		const movingWitness = [];
		for (const mode of ['scratch', 'legacy', 'borrowed']) {
			const [focus, moving] = await Promise.all(['first-focus', 'first-moving'].map(async phase =>
				decodeProofPng(await readFile(join(modes.get(mode)!, `${kind}-${phase}-scene.png`)))));
			let difference = 0;
			// Exclude the independent Background seed/status: the actual scene below
			// them must change when its existing geometry enters the moving pose.
			for (let index = 190 * focus.width * 4; index < focus.rgba.length; index++)
				difference = Math.max(difference, Math.abs(focus.rgba[index] - moving.rgba[index]));
			movingWitness.push({ mode, difference });
		}
		for (const witness of movingWitness) expect(witness.difference, `${kind}/${witness.mode} movement witness`).toBeGreaterThan(10);
		for (const phase of ['first-focus', 'first-moving', 'after-high-focus', 'after-high-moving']) {
			const file = `${kind}-${phase}-scene.png`;
			const legacy = decodeProofPng(await readFile(join(modes.get('legacy')!, file)));
			for (const mode of ['scratch', 'borrowed']) {
				const candidate = decodeProofPng(await readFile(join(modes.get(mode)!, file)));
				rows.push({ kind, phase, mode, width: candidate.width, height: candidate.height, movingWitness,
					maxError: proofPngDifference(candidate, legacy) });
			}
		}
	}
	await writeFile(info.outputPath('productive-scene-comparison.json'), JSON.stringify(rows, null, 2));
	for (const row of rows) {
		expect({ width: row.width, height: row.height }).toEqual({ width: 960, height: 640 });
		expect(row.maxError, JSON.stringify(row)).toBe(0);
	}
});
