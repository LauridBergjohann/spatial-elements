import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import { decodeProofPng, proofPngDifference, proofPngRgbRange } from './helpers/proofPng';

const query = 'stage-test=1&stage-background-output=1&stagedNavigation=1';
type Stats = ReturnType<NonNullable<Window['__stageVisualTest']>['getRenderTargetStats']>;
type OwnedStats = Stats & { backgroundOutput: Exclude<Stats['backgroundOutput'], { mode: 'legacy' }> };
type GpuCall = { method: string; time: number; phase?: string };
type PhaseSnapshot = { phase: string; time: number; owner: Stats['backgroundOutput'] };
declare global {
	interface Window {
		__backgroundStageProbe?: { calls: GpuCall[]; methods: string[]; phases: PhaseSnapshot[]; stop?: () => void };
	}
}

type Evidence = { protocol: string; errors: string[]; samples: { name: string; stats: Stats }[]; extra: Record<string, unknown> };
async function instrument(page: Page): Promise<Evidence> {
	const evidence: Evidence = { protocol: 'background-output-stage-v1', errors: [], samples: [], extra: {} };
	page.on('pageerror', error => evidence.errors.push(error.stack ?? error.message));
	await page.addInitScript(() => {
		const probe = { calls: [] as GpuCall[], methods: [] as string[], phases: [] as PhaseSnapshot[] };
		window.__backgroundStageProbe = probe;
		const device = (globalThis as unknown as { GPUDevice?: { prototype: Record<string, (...args: unknown[]) => unknown> } }).GPUDevice;
		for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createBuffer', 'createTexture']) {
			const original = device?.prototype[method];
			if (!device || !original) continue;
			probe.methods.push(method);
			device.prototype[method] = function (...args: unknown[]) {
				probe.calls.push({ method, time: performance.now(), phase: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase });
				return original.apply(this, args);
			};
		}
	});
	return evidence;
}

async function save(page: Page, info: TestInfo, evidence: Evidence) {
	const browser = await page.evaluate(() => {
		window.__backgroundStageProbe?.stop?.();
		return { probe: window.__backgroundStageProbe, timings: window.__stageVisualTest?.getNavigationTimings(),
			activity: window.__stageVisualTest?.getRenderActivity(), stats: window.__stageVisualTest?.getRenderTargetStats(),
			decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision };
	}).catch(error => ({ error: String(error) }));
	await writeFile(info.outputPath('background-output-stage.json'), JSON.stringify({ ...evidence, browser }, null, 2));
}

function assertOwner(stats: Stats, expectedId?: string): asserts stats is OwnedStats {
	const owner = stats.backgroundOutput;
	expect(owner.requested).toBe(true); expect(owner.initialized).toBe(true); expect(owner.mode).toBe('explicit');
	expect(owner.implicitBackgroundTarget, 'Missing diagnostics must not count as absence of a Three implicit target').toBe(false);
	expect(owner.targetTextureId).toBeTruthy();
	if (expectedId) expect(owner.targetTextureId).toBe(expectedId);
	expect(stats.targets.filter(target => target.id === owner.targetTextureId)).toHaveLength(1);
}

async function snapshot(page: Page, evidence: Evidence, name: string, expectedId?: string) {
	const stats = await page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats());
	evidence.samples.push({ name, stats }); assertOwner(stats, expectedId); return stats;
}

async function readySource(page: Page, evidence: Evidence, view: 'list' | 'carousel', area = 'demo') {
	await page.goto(`/${area}/categories/${view}?${query}`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
	const stats = await snapshot(page, evidence, 'source-ready');
	expect(stats.backgroundOutput.borrows).toBeGreaterThan(0);
	expect(stats.backgroundOutput.catalogProfile).toMatch(/^leased-canvas:/);
	expect(stats.backgroundOutput.catalogProfileCurrent).toBe(true);
	await page.evaluate(() => {
		const root = document.querySelector<HTMLElement>('.stage')!, probe = window.__backgroundStageProbe!;
		let previous: string | undefined;
		const observer = new MutationObserver(() => {
			const phase = root.dataset.catalogStagedPhase ?? 'idle';
			if (phase === previous) return;
			previous = phase;
			probe.phases.push({ phase, time: performance.now(), owner: window.__stageVisualTest!.getRenderTargetStats().backgroundOutput });
		});
		observer.observe(root, { attributes: true, attributeFilter: ['data-catalog-staged-phase'] });
		probe.stop = () => observer.disconnect();
	});
	const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
		: page.locator('[data-carousel-item="column"] .spatial-element-target');
	return { link, id: stats.backgroundOutput.targetTextureId!, stats };
}

async function revealed(page: Page, evidence: Evidence, id: string) {
	await expect.poll(() => page.evaluate(() => {
		const stage = document.querySelector<HTMLElement>('.stage');
		return window.__stageVisualTest?.getNavigationTimings().early?.revealed ? 'revealed'
			: stage?.dataset.catalogStagedDecision?.startsWith('cancelled:') ? 'cancelled' : 'pending';
	})).not.toBe('pending');
	const result = await page.evaluate(() => ({ timings: window.__stageVisualTest!.getNavigationTimings(), probe: window.__backgroundStageProbe! }));
	evidence.extra.forward = result;
	const early = result.timings.early!;
	expect(early?.revealed, JSON.stringify(result.timings)).toBeGreaterThan(0);
	expect(early.motionEnded).toBeGreaterThan(early.firstMotion);
	expect(early.revealEnded).toBeGreaterThan(early.revealStarted);
	expect(result.probe.methods).toHaveLength(5);
	const creates = result.probe.calls.filter(call => call.phase === 'moving' ||
		(call.time >= early.revealStarted && call.time <= early.revealEnded));
	expect(creates, 'Moving and the complete Reveal keep the existing zero-creation gate').toEqual([]);
	for (const phase of result.probe.phases) {
		expect(phase.owner.mode, JSON.stringify(phase)).toBe('explicit');
		expect(phase.owner.targetTextureId, JSON.stringify(phase)).toBe(id);
		expect(phase.owner.implicitBackgroundTarget, JSON.stringify(phase)).toBe(false);
	}
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
	await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
	return snapshot(page, evidence, 'detail-revealed', id);
}

async function cleanDestination(page: Page) {
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
	await expect(page.locator('[data-catalog-staged-hold], [data-catalog-transition-actors]')).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getSpatialCapture())).toBeNull();
}

for (const view of ['list', 'carousel'] as const) test(`${view} navigation shares one output target and preserves the outgoing Background during Back`, async ({ page }, info) => {
	const evidence = await instrument(page);
	try {
		const source = await readySource(page, evidence, view);
		await source.link.click(); await expect(page).toHaveURL(/\/demo\/elements\/column$/);
		await revealed(page, evidence, source.id);
		await page.evaluate(() => window.__stageVisualTest!.holdNextPageBinding());
		try {
			await page.goBack(); await expect(page).toHaveURL(new RegExp(`/demo/categories/${view}\\?`));
			await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().restoring)).toBeGreaterThan(0);
			expect(await page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().bound)).toBe(0);
			const before = await snapshot(page, evidence, 'back-held', source.id);
			expect(before.backgroundOutput.held).toBe(true);
			const canvas = page.locator('.stage-webgpu-background');
			const options = { style: '.stage > :not(.stage-webgpu-background), .stage > :not(.stage-webgpu-background) * { visibility: hidden !important; }' };
			const first = await canvas.screenshot(options); await writeFile(info.outputPath('back-held-before.png'), first);
			await page.evaluate(async () => { await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
			const second = await canvas.screenshot(options); await writeFile(info.outputPath('back-held-after.png'), second);
			const after = await snapshot(page, evidence, 'back-held-after-paint', source.id);
			const range = proofPngRgbRange(decodeProofPng(first)), maxError = proofPngDifference(decodeProofPng(first), decodeProofPng(second));
			evidence.extra.retention = { range, maxError };
			expect(range, 'Retained Background must contain actual nonuniform presented pixels').toBeGreaterThan(0);
			expect(maxError).toBe(0);
			expect(after.backgroundOutput.publications).toBe(before.backgroundOutput.publications);
			expect(after.backgroundOutput.borrows).toBe(before.backgroundOutput.borrows);
			expect(after.backgroundOutput.held).toBe(true);
		} finally { await page.evaluate(() => window.__stageVisualTest?.releasePageBinding()); }
		await cleanDestination(page);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
		const back = await snapshot(page, evidence, 'back-ready', source.id);
		expect(back.backgroundOutput.held).toBe(false); expect(back.backgroundOutput.catalogProfileCurrent).toBe(true);
		expect(await source.link.evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
		expect(evidence.errors).toEqual([]);
	} finally { await save(page, info, evidence); }
});

test('a Low-only detail prepares Full and Scroll targets, scrolls, zooms and resizes with the same output owner', async ({ page }, info) => {
	const evidence = await instrument(page);
	let release!: () => void;
	let highRequests = 0;
	const high = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/column-high.glb', async route => { highRequests++; await high; await route.continue().catch(() => {}); });
	try {
		const source = await readySource(page, evidence, 'list');
		await source.link.click(); await expect(page).toHaveURL(/\/demo\/elements\/column$/);
		await revealed(page, evidence, source.id);
		// The experimental output explicitly declines the old no-write Scroll
		// shortcut. Its conservative fallback prepares both existing quality sets.
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats().warmups)).toBeGreaterThan(source.stats.warmups);
		const warmed = await snapshot(page, evidence, 'low-only-scroll-warmed', source.id);
		expect(warmed.warmups - source.stats.warmups).toBe(2);
		expect(warmed.inactiveScrollWarmups).toBe(source.stats.inactiveScrollWarmups);
		expect(warmed.activeScale).toBe(1);
		expect(highRequests).toBeGreaterThan(0);
		expect(await page.evaluate(() => window.__stageVisualTest!.getCatalogPresentation()?.representations.hero)).toBe('low');
		evidence.extra.highBlockedThroughScrollAndZoom = true;
		await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
		await expect(page.locator('[data-spatial-element-sticky-header]')).toHaveAttribute('data-active', '');
		await snapshot(page, evidence, 'low-only-scrolled', source.id);
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
		const minimapPasses = await page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().minimapSceneRenderPasses);
		await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.6, azimuth: 25 }, 60));
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeGreaterThan(0.3);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().minimapSceneRenderPasses)).toBeGreaterThan(minimapPasses);
		expect((await page.evaluate(() => window.__stageVisualTest!.getMinimapRect()))!.width).toBeGreaterThan(20);
		expect(await page.evaluate(() => window.__stageVisualTest!.getCatalogPresentation()?.representations.hero)).toBe('low');
		await snapshot(page, evidence, 'low-only-zoom', source.id);
		await page.evaluate(() => window.__stageVisualTest!.reset());
		const before = await snapshot(page, evidence, 'before-resize', source.id);
		await page.setViewportSize({ width: 1280, height: 900 });
		await expect.poll(() => page.evaluate(() => {
			const owner = window.__stageVisualTest!.getRenderTargetStats().backgroundOutput;
			return owner.mode === 'legacy' ? null : owner.width;
		})).toBe(1280);
		const resized = await snapshot(page, evidence, 'after-resize', source.id);
		expect(resized.backgroundOutput.height).toBe(900);
		expect(resized.backgroundOutput.generation).toBeGreaterThan(before.backgroundOutput.generation!);
		expect(evidence.errors).toEqual([]);
	} finally { release(); await save(page, info, evidence); }
});

for (const interruption of ['Escape', 'resize'] as const) test(`a slow Carousel ${interruption} abort restores the source and borrowed-output readiness`, async ({ page }, info) => {
	const evidence = await instrument(page);
	let release!: () => void;
	const blocked = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/staged/elements/*/__data.json*', async route => {
		const response = await route.fetch(); await blocked; await route.fulfill({ response }).catch(() => {});
	});
	try {
		const source = await readySource(page, evidence, 'carousel', 'staged');
		const field = page.locator('[data-carousel-item="column"] textarea');
		await field.fill('Same live instance after abort');
		const original = await field.elementHandle();
		await source.link.evaluate((node: HTMLAnchorElement) => node.click());
		await expect(page.locator('.stage')).toHaveAttribute('data-catalog-staged-phase', 'held');
		await expect(page.locator('[data-spatial-element-root]')).toHaveCount(0);
		await snapshot(page, evidence, 'source-held', source.id);
		if (interruption === 'Escape') await page.keyboard.press('Escape');
		else await page.setViewportSize({ width: 1280, height: 900 });
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
		await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
		await expect(page).toHaveURL(/\/staged\/categories\/carousel\?/);
		expect(await field.evaluate((node, old) => node === old, original)).toBe(true);
		await expect(field).toHaveValue('Same live instance after abort');
		expect(await field.evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
		release();
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
		await snapshot(page, evidence, 'abort-source-ready', source.id);
		const calls = await page.evaluate(() => window.__backgroundStageProbe!.calls.filter(call => call.phase === 'moving'));
		expect(calls).toEqual([]); expect(evidence.errors).toEqual([]);
	} finally { release(); await save(page, info, evidence); }
});
