import { expect, test } from '@playwright/test';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from './helpers/proofPng';
import type { BackgroundCheckpointApi } from '../apps/tests/src/routes/proof/background-layer-output/checkpoints';
import type { FadeReuseProof } from '../apps/tests/src/routes/proof/catalog-warm-output/proof';

interface ProofResult { error?: string; stack?: string; gpuErrors: string[]; fadeReuse?: FadeReuseProof }
type ProofWindow = Window & { __catalogWarmOutputCheckpoints?: BackgroundCheckpointApi; __catalogWarmOutputProof?: ProofResult };
test.describe.configure({ mode: 'serial' });

for (const mode of ['control', 'candidate'] as const) test(`frozen catalog fade ${mode} preserves live Glass and geometry`, async ({ page }, info) => {
	const pageErrors: string[] = [];
	page.on('pageerror', error => pageErrors.push(String(error)));
	await page.goto(`/proof/catalog-warm-output?warm-mode=scratch&fade-reuse=${mode}`);
	const phases: string[] = [];
	try {
		let released = 0;
		while (true) {
			await page.waitForFunction(last => {
				const scope = window as ProofWindow;
				return Boolean(scope.__catalogWarmOutputProof) || (scope.__catalogWarmOutputCheckpoints?.getCurrent()?.id ?? 0) > last;
			}, released, { timeout: 90000 });
			const state = await page.evaluate(() => {
				const scope = window as ProofWindow;
				return { result: scope.__catalogWarmOutputProof, point: scope.__catalogWarmOutputCheckpoints?.getCurrent() };
			});
			if (state.result) {
				expect(state.result.error, state.result.stack).toBeUndefined();
				expect(state.result.gpuErrors).toEqual([]);
				const proof = state.result.fadeReuse!;
				expect(proof.mode).toBe(mode);
				expect(proof.frames).toHaveLength(24);
				for (const row of proof.frames) {
					expect(row.creates, row.phase).toEqual([]);
					const hit = row.phase.endsWith('/moving-reuse') || row.phase.endsWith('/moving-reuse-again');
					expect(row.draws, row.phase).toBe(mode === 'candidate' && hit ? 0 : 1);
				}
				expect(pageErrors).toEqual([]);
				await writeFile(info.outputPath('fade-reuse.json'), JSON.stringify({ proof, phases, pageErrors, gpuErrors: state.result.gpuErrors }, null, 2));
				break;
			}
			const point = state.point!;
			expect(point.id).toBeGreaterThan(released);
			if (/\/moving(?:-|$)/.test(point.phase)) {
				phases.push(point.phase);
				const scene = page.locator('[data-catalog-warm-canvas="front"]');
				expect(await scene.boundingBox()).toEqual({ x: 0, y: 0, width: 960, height: 640 });
				await writeFile(info.outputPath(`${point.phase.replaceAll('/', '-')}.png`), await scene.screenshot({
					style: '[data-catalog-warm-canvas="background"], .status { visibility: hidden !important; }'
				}));
			}
			released = point.id;
			expect(await page.evaluate(id => (window as ProofWindow).__catalogWarmOutputCheckpoints!.release(id), point.id)).toBe(true);
		}
	} finally {
		const state = await page.evaluate(() => ({ result: (window as ProofWindow).__catalogWarmOutputProof,
			point: (window as ProofWindow).__catalogWarmOutputCheckpoints?.getCurrent() })).catch(error => ({ error: String(error) }));
		await writeFile(info.outputPath('terminal.json'), JSON.stringify({ mode, phases, pageErrors, state }, null, 2));
	}
});

test('retained captures match every control frame and reduce only repeated capture work', async ({}, info) => {
	const directories = await readdir(info.project.outputDir, { withFileTypes: true });
	const modes = new Map<string, { directory: string; proof: FadeReuseProof; phases: string[] }>();
	for (const entry of directories) {
		if (!entry.isDirectory()) continue;
		const directory = join(info.project.outputDir, entry.name);
		const raw = await readFile(join(directory, 'fade-reuse.json'), 'utf8').catch(() => null);
		if (!raw) continue;
		const data = JSON.parse(raw) as { proof: FadeReuseProof; phases: string[] };
		modes.set(data.proof.mode, { directory, ...data });
	}
	expect([...modes.keys()].sort()).toEqual(['candidate', 'control']);
	const control = modes.get('control')!, candidate = modes.get('candidate')!;
	expect(candidate.phases).toEqual(control.phases);
	expect(candidate.phases).toHaveLength(24);
	const comparisons = [];
	for (const phase of candidate.phases) {
		const file = `${phase.replaceAll('/', '-')}.png`;
		const [baseline, retained] = await Promise.all([control, candidate].map(async mode => decodeProofPng(await readFile(join(mode.directory, file)))));
		const original = control.proof.frames.find(row => row.phase === phase)!;
		const reused = candidate.proof.frames.find(row => row.phase === phase)!;
		const hit = phase.endsWith('/moving-reuse') || phase.endsWith('/moving-reuse-again');
		comparisons.push({ phase, maxError: proofPngDifference(baseline, retained), rgbRange: proofPngRgbRange(retained),
			controlSubmits: original.submits, candidateSubmits: reused.submits, controlDraws: original.draws, candidateDraws: reused.draws });
		expect(comparisons.at(-1)!.maxError, phase).toBe(0);
		expect(proofPngRgbRange(retained), phase).toBeGreaterThan(40);
		if (hit) expect(reused.submits, phase).toBeLessThan(original.submits);
		else expect(reused.submits, phase).toBe(original.submits);
	}
	const movement = [];
	for (const kind of ['list', 'frosted', 'glass']) for (const cycle of ['first', 'after-high']) {
		const [first, next] = await Promise.all(['moving', 'moving-reuse'].map(async phase =>
			decodeProofPng(await readFile(join(candidate.directory, `${kind}-${cycle}-${phase}.png`)))));
		movement.push({ kind, cycle, maxDifference: proofPngDifference(first, next) });
		expect(movement.at(-1)!.maxDifference, `${kind}/${cycle} live movement`).toBeGreaterThan(10);
	}
	await writeFile(info.outputPath('pixel-and-work-comparison.json'), JSON.stringify({ comparisons, movement }, null, 2));
});
