import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('experimental Background layer preserves real glass, output and Frosted DOM with one final transform', async ({ page }, testInfo) => {
	const errors: string[] = []; page.on('pageerror', error => errors.push(String(error)));
	await page.goto('/proof/background-layer-output');
	const status = page.locator('[data-background-layer-proof-state]');
	await expect(status).not.toHaveAttribute('data-background-layer-proof-state', 'preparing', { timeout: 90000 });
	const proof = await page.evaluate(() => (window as unknown as { __backgroundLayerProof: {
		rows: { mode: string; alpha: number; eligible: boolean; width: number; height: number; dpr: number; maxLinearError: number; maxCanvasError: number; minAlpha: number; maxAlpha: number; hdrMax: number;
			referenceMinAlpha: number; referenceMaxAlpha: number; readbackLayout: { width: number; height: number; pixelValues: number };
			referenceSubmits: number; candidateSubmits: number; panelDifference: number; flagsRestored: boolean }[];
		readbackControls: { maxError: number; layout: { width: number; height: number; pixelValues: number } }[];
		errors: string[]; failureStateRestored: boolean; recoveryCanvasError: number; linearReadback: string; memory: unknown;
	} }).__backgroundLayerProof);
	await writeFile(testInfo.outputPath('background-layer-output.json'), JSON.stringify(proof, null, 2));
	await expect(status).toHaveAttribute('data-background-layer-proof-state', 'ready');
	expect(errors).toEqual([]); expect(proof.errors).toEqual([]); expect(proof.rows).toHaveLength(18);
	expect(proof.readbackControls).toHaveLength(2);
	for (const control of proof.readbackControls) {
		expect(control.maxError, JSON.stringify(control)).toBe(0);
		expect(control.layout.pixelValues).toBe(control.layout.width * control.layout.height * 4);
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
	}
	expect(proof.failureStateRestored).toBe(true); expect(proof.recoveryCanvasError).toBe(0);
	const surfaces = page.locator('[data-stage-panel-css-surface]');
	await expect(surfaces).toHaveCount(2);
	expect(await surfaces.evaluateAll(nodes => nodes.map(node => getComputedStyle(node, '::before').backdropFilter))).toEqual(['blur(5px)', 'blur(5px)']);
	await page.evaluate(async () => { await document.fonts.ready; await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
	const reference = await page.locator('[data-background-layer-reference]').screenshot();
	const candidate = await page.locator('[data-background-layer-candidate]').screenshot();
	await writeFile(testInfo.outputPath('reference-frosted.png'), reference); await writeFile(testInfo.outputPath('candidate-frosted.png'), candidate);
	const domDifference = await page.evaluate(async ([left, right]) => {
		const read = async (base64: string) => {
			const bytes = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
			const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
			const canvas = new OffscreenCanvas(image.width, image.height), context = canvas.getContext('2d')!;
			context.drawImage(image, 0, 0); image.close(); return context.getImageData(0, 0, canvas.width, canvas.height).data;
		};
		const a = await read(left), b = await read(right); let max = 0;
		if (a.length !== b.length) return -1;
		for (let i = 0; i < a.length; i++) max = Math.max(max, Math.abs(a[i] - b[i])); return max;
	}, [reference.toString('base64'), candidate.toString('base64')]);
	await writeFile(testInfo.outputPath('frosted-dom-comparison.json'), JSON.stringify({ maxChannelError: domDifference }, null, 2));
	expect(domDifference).toBe(0);
});
