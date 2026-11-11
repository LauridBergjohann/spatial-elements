import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { decodeProofPng, proofPngDifference, proofPngRgbRange, type ProofPng } from './helpers/proofPng';
import type { BackgroundCheckpoint, BackgroundCheckpointApi } from '../apps/tests/src/routes/proof/background-layer-output/checkpoints';

interface CheckpointObservation extends BackgroundCheckpoint {
	canvasRects: { x: number; y: number; width: number; height: number }[];
	screenshotSizes: { width: number; height: number }[];
	referenceCandidateError: number;
	referenceRgbRange: number;
	candidateRgbRange: number;
	referenceSourceError: number | null;
	candidateSourceError: number | null;
	referenceInitialClearError: number | null;
	candidateInitialClearError: number | null;
	maskedPublicationDiagnostic: { acceptedRetentionPath: false; preserved: boolean } | null;
}

test('experimental Background layer preserves real glass, output and Frosted DOM with one final transform', async ({ page }, testInfo) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(String(error)));
	await page.goto('/proof/background-layer-output?lifecycle-checkpoints=1');
	const status = page.locator('[data-background-layer-proof-state]');
	const observations: CheckpointObservation[] = [];
	let frostedOwner: { ownerMode: string | undefined; maxChannelError: number; width: number; height: number } | undefined;
	const sources = new Map<string, [ProofPng, ProofPng]>(), initialClears = new Map<string, [ProofPng, ProofPng]>();
	let lastId = 0;
	while (true) {
		await page.waitForFunction(id => {
			const api = (window as unknown as { __backgroundLayerCheckpoints?: BackgroundCheckpointApi }).__backgroundLayerCheckpoints;
			const terminal = document.querySelector('[data-background-layer-proof-state]')?.getAttribute('data-background-layer-proof-state');
			return /^(ready|error)$/.test(terminal ?? '') || (api?.getCurrent()?.id ?? 0) > id;
		}, lastId, { timeout: 90000 });
		const point = await page.evaluate(() => (window as unknown as { __backgroundLayerCheckpoints?: BackgroundCheckpointApi }).__backgroundLayerCheckpoints?.getCurrent());
		if (!point) break;
		if (point.phase === 'owner-frosted') {
			expect(point.ownerMode).toBe('explicit');
			const surfaces = page.locator('[data-stage-panel-css-surface]'); await expect(surfaces).toHaveCount(2);
			expect(await surfaces.evaluateAll(nodes => nodes.map(node => getComputedStyle(node, '::before').backdropFilter))).toEqual(['blur(5px)', 'blur(5px)']);
			await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
			const images = [];
			for (const side of ['reference', 'candidate']) {
				const host = page.locator(`[data-background-layer-${side}]`);
				const rect = await host.boundingBox();
				expect(rect && Object.values(rect).every(Number.isInteger), JSON.stringify(rect)).toBe(true);
				const png = await host.screenshot(); await writeFile(testInfo.outputPath(`${side}-frosted-owner.png`), png);
				images.push(decodeProofPng(png));
			}
			frostedOwner = { ownerMode: point.ownerMode, maxChannelError: proofPngDifference(images[0], images[1]), width: images[0].width, height: images[0].height };
			await writeFile(testInfo.outputPath('frosted-owner-dom-comparison.json'), JSON.stringify(frostedOwner, null, 2));
			expect(await page.evaluate(id => (window as unknown as { __backgroundLayerCheckpoints: BackgroundCheckpointApi }).__backgroundLayerCheckpoints.release(id), point.id)).toBe(true);
			lastId = point.id; continue;
		}
		const key = `${point.width}x${point.height}@${point.dpr}`, prefix = `${point.id}-${key}-${point.phase}`;
		const screenshots = [], canvasRects = [];
		for (const side of ['reference', 'candidate']) {
			const canvas = page.locator(`[data-background-lifecycle-canvas="${side}"]`);
			canvasRects.push(await canvas.evaluate(node => {
				const { x, y, width, height } = node.getBoundingClientRect(); return { x, y, width, height };
			}));
			const png = await canvas.screenshot();
			await writeFile(testInfo.outputPath(`${prefix}-${side}.png`), png);
			screenshots.push(decodeProofPng(png));
		}
		const pixels: [ProofPng, ProofPng] = [screenshots[0], screenshots[1]];
		if (point.phase === 'initial-transparent-clear') initialClears.set(key, pixels);
		if (point.phase === 'published-source') sources.set(key, pixels);
		const source = sources.get(key), initial = initialClears.get(key);
		const observation: CheckpointObservation = {
			...point, canvasRects, screenshotSizes: pixels.map(({ width, height }) => ({ width, height })),
			referenceCandidateError: proofPngDifference(...pixels),
			referenceRgbRange: proofPngRgbRange(pixels[0]), candidateRgbRange: proofPngRgbRange(pixels[1]),
			referenceSourceError: source ? proofPngDifference(source[0], pixels[0]) : null,
			candidateSourceError: source ? proofPngDifference(source[1], pixels[1]) : null,
			referenceInitialClearError: initial ? proofPngDifference(initial[0], pixels[0]) : null,
			candidateInitialClearError: initial ? proofPngDifference(initial[1], pixels[1]) : null,
			maskedPublicationDiagnostic: point.phase === 'masked-output-warm'
				? { acceptedRetentionPath: false, preserved: Boolean(source && proofPngDifference(source[1], pixels[1]) === 0) } : null
		};
		observations.push(observation);
		await writeFile(testInfo.outputPath('lifecycle-dom-checkpoints.json'), JSON.stringify({ protocol: 'background-lifecycle-dom-v2-owner', observations }, null, 2));
		for (let index = 0; index < canvasRects.length; index++) {
			const rect = canvasRects[index];
			expect(Object.values(rect).every(Number.isInteger), JSON.stringify(observation)).toBe(true);
			expect({ width: rect.width, height: rect.height }).toEqual({ width: point.width, height: point.height });
			expect(observation.screenshotSizes[index]).toEqual({ width: point.width, height: point.height });
		}
		if (point.phase === 'initial-transparent-clear') {
			expect(observation.referenceRgbRange, JSON.stringify(observation)).toBe(0);
			expect(observation.candidateRgbRange, JSON.stringify(observation)).toBe(0);
		}
		// Never prepare another source against an unproved, empty displayed baseline.
		if (point.phase === 'published-source') {
			expect(observation.referenceRgbRange, JSON.stringify(observation)).toBeGreaterThan(20);
			expect(observation.candidateRgbRange, JSON.stringify(observation)).toBeGreaterThan(20);
		}
		expect(await page.evaluate(id => (window as unknown as { __backgroundLayerCheckpoints: BackgroundCheckpointApi }).__backgroundLayerCheckpoints.release(id), point.id)).toBe(true);
		lastId = point.id;
	}
	await expect(status).toHaveAttribute('data-background-layer-proof-state', /^(ready|error)$/, { timeout: 90000 });
	const terminalState = await status.getAttribute('data-background-layer-proof-state');
	const proof = await page.evaluate(() => (window as unknown as { __backgroundLayerProof: {
		error?: string; stack?: string | null;
		protocol: string;
		rows: { mode: string; alpha: number; eligible: boolean; width: number; height: number; dpr: number; maxLinearError: number; maxCanvasError: number; minAlpha: number; maxAlpha: number; hdrMax: number;
			referenceMinAlpha: number; referenceMaxAlpha: number; readbackLayout: { width: number; height: number; pixelValues: number };
			referenceSubmits: number; candidateSubmits: number; panelDifference: number; flagsRestored: boolean; ownerMode: string }[];
		readbackControls: { maxError: number; layout: { width: number; height: number; pixelValues: number } }[];
		ownerRestorations: boolean[];
		lifecycle: { checkpointsEnabled: boolean; initialImplicit: boolean[]; disposedImplicit: boolean[]; presence: { phase: string; reference: boolean; candidate: boolean }[];
			ownerDisposed: boolean; disposedHandleInvalid: boolean;
			scratchRows: { dpr: number; borrowed: boolean; stateRestored: boolean; nestedPublishRejected: boolean; invalidPublishDeclined: boolean;
				invalidPublishSubmits: number; destructiveLinearDifference: number; rebuildCompleted: boolean; republished: boolean; republishSubmits: number }[];
			resizeGuards: { staleImmediately: boolean; blockedBeforeResize: boolean; resized: boolean; sameTarget: boolean; staleAfterResize: boolean; newHandleCurrent: boolean }[];
			clearRows: { phase: string; referenceSubmits: number; candidateSubmits: number; maxLinearError: number; maxCanvasError: number;
				maxLinearZeroError: number; maxCanvasZeroError: number; flagsRestored: boolean }[];
			heldRows: { sourceImmediateCanvasError: number; skippedReferenceSubmits: number; skippedCandidateSubmits: number;
				warmSubmits: number; warmStateRestored: boolean; preparedLinearDifference: number;
				maskedWarmSubmits: number; maskedWarmStateRestored: boolean;
				publishedImmediateCanvasError: number; publishedLinearError: number; immediateIncomingCanvasDifference: number }[] };
		errors: string[]; failureStateRestored: boolean; recoveryCanvasError: number; finalCanvasError: number; fallbackStayedTerminal: boolean; linearReadback: string; memory: unknown;
	} }).__backgroundLayerProof);
	await writeFile(testInfo.outputPath('background-layer-output.json'), JSON.stringify(proof, null, 2));
	expect(terminalState, proof.error ? `${proof.error}\n${proof.stack ?? ''}` : undefined).toBe('ready');
	expect(proof.protocol).toBe('background-layer-output-v5-owner');
	expect(frostedOwner).toEqual({ ownerMode: 'explicit', maxChannelError: 0, width: 200, height: 144 });
	expect(errors).toEqual([]); expect(proof.errors).toEqual([]); expect(proof.rows).toHaveLength(18);
	expect(proof.ownerRestorations.length).toBeGreaterThan(20);
	expect(proof.ownerRestorations.every(value => value)).toBe(true);
	expect(proof.readbackControls).toHaveLength(2);
	for (const control of proof.readbackControls) {
		expect(control.maxError, JSON.stringify(control)).toBe(0);
		expect(control.layout.pixelValues).toBe(control.layout.width * control.layout.height * 4);
	}
	expect(proof.lifecycle.initialImplicit).toEqual([false, false]);
	expect(proof.lifecycle.checkpointsEnabled).toBe(true);
	expect(proof.lifecycle.disposedImplicit).toEqual([false, false]);
	expect(proof.lifecycle.ownerDisposed).toBe(true); expect(proof.lifecycle.disposedHandleInvalid).toBe(true);
	expect(proof.lifecycle.resizeGuards).toHaveLength(1);
	for (const row of proof.lifecycle.resizeGuards) expect(row).toEqual({ staleImmediately: true, blockedBeforeResize: true,
		resized: true, sameTarget: true, staleAfterResize: true, newHandleCurrent: true });
	expect(proof.lifecycle.scratchRows).toHaveLength(2);
	for (const row of proof.lifecycle.scratchRows) {
		expect(row.borrowed).toBe(true); expect(row.stateRestored).toBe(true); expect(row.nestedPublishRejected).toBe(true);
		expect(row.invalidPublishDeclined).toBe(true); expect(row.invalidPublishSubmits).toBe(0);
		expect(row.destructiveLinearDifference).toBeGreaterThan(0.1);
		expect(row.rebuildCompleted).toBe(true); expect(row.republished).toBe(true); expect(row.republishSubmits).toBe(1);
	}
	expect(proof.lifecycle.presence.length).toBeGreaterThan(8);
	for (const sample of proof.lifecycle.presence) expect(sample.candidate, JSON.stringify(sample)).toBe(false);
	expect(proof.lifecycle.presence.some(sample => sample.reference)).toBe(true);
	expect(proof.lifecycle.clearRows).toHaveLength(4);
	for (const row of proof.lifecycle.clearRows) {
		expect(row.maxLinearError, JSON.stringify(row)).toBe(0); expect(row.maxCanvasError, JSON.stringify(row)).toBe(0);
		expect(row.maxLinearZeroError, JSON.stringify(row)).toBe(0); expect(row.maxCanvasZeroError, JSON.stringify(row)).toBe(0);
		expect(row.referenceSubmits).toBe(2); expect(row.candidateSubmits).toBe(2); expect(row.flagsRestored).toBe(true);
	}
	expect(proof.lifecycle.heldRows).toHaveLength(2);
	for (const row of proof.lifecycle.heldRows) {
		expect(row.sourceImmediateCanvasError, JSON.stringify(row)).toBe(0);
		expect(row.skippedReferenceSubmits).toBe(0); expect(row.skippedCandidateSubmits).toBe(0);
		expect(row.warmSubmits).toBe(5); expect(row.warmStateRestored).toBe(true);
		expect(row.preparedLinearDifference).toBeGreaterThan(0.1);
		expect(row.maskedWarmSubmits).toBe(6); expect(row.maskedWarmStateRestored).toBe(true);
		expect(row.publishedImmediateCanvasError, JSON.stringify(row)).toBe(0); expect(row.publishedLinearError, JSON.stringify(row)).toBe(0);
		expect(row.immediateIncomingCanvasDifference).toBeGreaterThan(10);
	}
	expect(observations).toHaveLength(22);
	const expectedPhases = ['initial-transparent-clear', 'published-source', 'held-no-work', 'held-content-only',
		'scratch-borrow', 'scratch-rebuilt-offscreen', 'scratch-republished', 'offscreen-warm', 'masked-output-warm', 'published-incoming', 'transparent-clear-after-content'];
	for (const key of sources.keys()) expect(observations.filter(row => `${row.width}x${row.height}@${row.dpr}` === key).map(row => row.phase)).toEqual(expectedPhases);
	for (const row of observations) {
		if (row.phase === 'masked-output-warm') {
			// Separate, explicitly unaccepted candidate: record exact candidate error/preservation, do not claim a pass.
			expect(row.referenceSourceError, JSON.stringify(row)).toBe(0);
			expect(row.maskedPublicationDiagnostic?.acceptedRetentionPath).toBe(false);
			continue;
		}
		expect(row.referenceCandidateError, JSON.stringify(row)).toBe(0);
		if (['held-no-work', 'held-content-only', 'scratch-borrow', 'scratch-rebuilt-offscreen', 'scratch-republished', 'offscreen-warm'].includes(row.phase)) {
			expect(row.referenceSourceError, JSON.stringify(row)).toBe(0); expect(row.candidateSourceError, JSON.stringify(row)).toBe(0);
		}
		if (row.phase === 'published-incoming') {
			expect(row.referenceSourceError, JSON.stringify(row)).toBeGreaterThan(10); expect(row.candidateSourceError, JSON.stringify(row)).toBeGreaterThan(10);
		}
		if (row.phase === 'transparent-clear-after-content') {
			expect(row.referenceInitialClearError, JSON.stringify(row)).toBe(0); expect(row.candidateInitialClearError, JSON.stringify(row)).toBe(0);
		}
	}
	for (const row of proof.rows) {
		expect(row.maxLinearError, JSON.stringify(row)).toBe(0);
		expect(row.maxCanvasError, JSON.stringify(row)).toBe(0);
		expect(row.flagsRestored, JSON.stringify(row)).toBe(true);
		expect(row.readbackLayout).toMatchObject({ width: Math.floor(row.width * row.dpr), height: Math.floor(row.height * row.dpr),
			pixelValues: Math.floor(row.width * row.dpr) * Math.floor(row.height * row.dpr) * 4 });
		expect(row.minAlpha).toBe(row.referenceMinAlpha); expect(row.maxAlpha).toBe(row.referenceMaxAlpha);
		if (row.alpha === 0) { expect(row.minAlpha).toBe(1); expect(row.maxAlpha).toBe(1); }
		else { expect(row.minAlpha).toBeGreaterThan(0); expect(row.maxAlpha).toBeGreaterThan(1); }
		expect(row.hdrMax).toBeGreaterThan(1);
		if (row.alpha > 0 && row.mode !== 'clear-depth') expect(row.panelDifference, JSON.stringify(row)).toBeGreaterThan(10);
		if (row.eligible && row.alpha > 0) expect(row.referenceSubmits - row.candidateSubmits, JSON.stringify(row)).toBe(4);
		else expect(row.candidateSubmits, JSON.stringify(row)).toBe(row.referenceSubmits);
		expect(row.ownerMode).toBe(row.eligible ? 'explicit' : 'fallback');
	}
	expect(proof.failureStateRestored).toBe(true); expect(proof.recoveryCanvasError).toBe(0);
	expect(proof.finalCanvasError).toBe(0); expect(proof.fallbackStayedTerminal).toBe(true);
	const surfaces = page.locator('[data-stage-panel-css-surface]');
	await expect(surfaces).toHaveCount(2);
	expect(await surfaces.evaluateAll(nodes => nodes.map(node => getComputedStyle(node, '::before').backdropFilter))).toEqual(['blur(5px)', 'blur(5px)']);
	await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
	const reference = await page.locator('[data-background-layer-reference]').screenshot();
	const candidate = await page.locator('[data-background-layer-candidate]').screenshot();
	await writeFile(testInfo.outputPath('reference-frosted.png'), reference); await writeFile(testInfo.outputPath('candidate-frosted.png'), candidate);
	const domDifference = proofPngDifference(decodeProofPng(reference), decodeProofPng(candidate));
	await writeFile(testInfo.outputPath('frosted-dom-comparison.json'), JSON.stringify({ phase: 'terminal-fallback', maxChannelError: domDifference }, null, 2));
	expect(domDifference).toBe(0);
});
