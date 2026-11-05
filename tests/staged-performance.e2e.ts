import { expect, test, type Page } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { cpus, platform, release } from 'node:os';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

// Twenty fresh contexts per source and temperature; no samples are discarded.
// Set a smaller count only for diagnosis; acceptance uses the default count.
const samples = Number(process.env.SPATIAL_PERFORMANCE_SAMPLES ?? 20);
if (!Number.isInteger(samples) || samples < 1) throw new Error('SPATIAL_PERFORMANCE_SAMPLES must be a positive integer');
const endpoint = process.env.SPATIAL_PERFORMANCE_ENDPOINT === 'dock' ? 'dock' : 'hero';
const width = Number(process.env.SPATIAL_PERFORMANCE_WIDTH ?? 1440);
if (!Number.isInteger(width) || width < 320) throw new Error('SPATIAL_PERFORMANCE_WIDTH must be an integer >= 320');
const percentile = (values: number[], fraction: number) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const measurementProtocol = 'staged-performance-v2';
const backgroundOutputVariant = process.env.SPATIAL_PERFORMANCE_BACKGROUND_OUTPUT === '1' ? 'explicit-owner' : 'default';
const backgroundOutputEnabled = backgroundOutputVariant === 'explicit-owner';

async function snapshotBackgroundOutput(page: Page) {
	return page.evaluate(() => {
		const stats = window.__stageVisualTest!.getRenderTargetStats();
		return { owner: stats.backgroundOutput,
			matchingTargetCount: stats.targets.filter(target => target.id === stats.backgroundOutput.targetTextureId).length };
	});
}

function validateBackgroundOutput(snapshot: Awaited<ReturnType<typeof snapshotBackgroundOutput>> | null) {
	expect.soft(snapshot?.owner.requested).toBe(true);
	expect.soft(snapshot?.owner.initialized).toBe(true);
	expect.soft(snapshot?.owner.mode).toBe('explicit');
	expect.soft(snapshot?.owner.implicitBackgroundTarget, 'Missing diagnostics do not establish absence of an implicit Background target').toBe(false);
	expect.soft(snapshot?.owner.targetTextureId).toEqual(expect.any(String));
	expect.soft(snapshot?.owner.targetTextureId).not.toBe('');
	expect.soft(snapshot?.matchingTargetCount).toBe(1);
}
type Activation = 'synthetic' | 'pointer' | 'enter';
const activation = (process.env.SPATIAL_PERFORMANCE_ACTIVATION ?? 'synthetic') as Activation;
if (!['synthetic', 'pointer', 'enter'].includes(activation)) throw new Error('SPATIAL_PERFORMANCE_ACTIVATION must be synthetic, pointer or enter');
const temperatures = activation === 'synthetic' ? ['cold', 'warm'] as const : ['warm'] as const;
type InputObservation = { observedAt: number; timeStamp: number; isTrusted: boolean; pointerType?: string; key?: string };
type ActivationObservation = {
	preActivationActivity: unknown; clickActivity?: unknown;
	clickObservedAt?: number; clickEventTimeStamp?: number; isTrusted?: boolean; clickDetail?: number;
	pointerDown?: InputObservation; pointerUp?: InputObservation; keyDown?: InputObservation;
};

for (const view of ['list', 'carousel'] as const) for (const temperature of temperatures) {
	test(`${width}px ${view} to ${endpoint}: ${samples} ${temperature} data and module navigations${activation === 'synthetic' ? '' : ` [trusted ${activation}]`}${backgroundOutputEnabled ? ' [background explicit-owner]' : ''}`, async ({ browser, baseURL }, testInfo) => {
		const results: { latency: number; submitted: number; observedDomChange: number; budget: number; gaps: number[]; timings: unknown; requests: { name: string; start: number; duration: number }[] }[] = [];
		for (let sample = 0; sample < samples; sample++) {
			const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 } });
			try {
				const page = await context.newPage();
				// Measure display cadence before the application can saturate the GPU.
				// A slow source frame must not silently redefine a 60 Hz budget as 30 Hz.
				const { budget: idleBudget, calibration: idleCalibration } = await page.evaluate(async () => {
					const times: number[] = [];
					let visibleThroughout = document.visibilityState === 'visible';
					const visibilityChanged = () => { visibleThroughout &&= document.visibilityState === 'visible'; };
					document.addEventListener('visibilitychange', visibilityChanged);
					// Extra samples belong to the empty document, never a longer source-page wait.
					// The acceptance budget still uses exactly the original first eleven gaps.
					try {
						for (let i = 0; i < 121; i++) await new Promise<void>(resolve => requestAnimationFrame(time => { times.push(time); resolve(); }));
					} finally { document.removeEventListener('visibilitychange', visibilityChanged); }
					const gaps = times.slice(1, 12).map((time, index) => time - times[index]).sort((a, b) => a - b);
					return { budget: gaps[Math.floor(gaps.length / 2)], calibration: {
						version: 'cadence-diagnostic-v1', timestamps: times,
						document: 'blank-before-app', clock: 'raf-before-navigation',
						crossOriginIsolated, visibilityState: document.visibilityState, visibleThroughout
					} };
				});
				const errors: string[] = [];
				page.on('pageerror', error => errors.push(error.message));
				await page.addInitScript(() => {
					const work = { longFrames: [] as unknown[], gpuCalls: [] as { method: string; time: number; phase?: string }[], adapter: {} as Record<string, string> };
					const gpu = (navigator as unknown as { gpu?: { requestAdapter: (...args: unknown[]) => Promise<{ info?: Record<string, string> } | null> } }).gpu;
					if (gpu) {
						const request = gpu.requestAdapter;
						gpu.requestAdapter = async function (...args: unknown[]) {
							const adapter = await request.apply(this, args);
							for (const key of ['vendor', 'architecture', 'device', 'description']) work.adapter[key] = adapter?.info?.[key] ?? '';
							return adapter;
						};
					}
					if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) new PerformanceObserver(list => {
						work.longFrames.push(...list.getEntries().map(entry => entry.toJSON()));
					}).observe({ type: 'long-animation-frame', buffered: true });
					const device = (globalThis as unknown as { GPUDevice?: { prototype: Record<string, (...args: unknown[]) => unknown> } }).GPUDevice;
					for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createBuffer', 'createTexture']) {
						const original = device?.prototype[method];
						if (device && original) device.prototype[method] = function (...args: unknown[]) {
							work.gpuCalls.push({ method, time: performance.now(), phase: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase });
							return original.apply(this, args);
						};
					}
					Object.assign(window, { performanceWork: work });
				});
				await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1${backgroundOutputEnabled ? '&stage-background-output=1' : ''}`);
				await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
				const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
					: page.locator('[data-carousel-item="column"] .spatial-element-target');
				if (endpoint === 'hero') await link.evaluate((node: HTMLAnchorElement) => { const url = new URL(node.href); url.hash = ''; node.href = url.href; });
				await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
				// Read once outside the measured interval; never add owner inspection to RAF sampling.
				const backgroundOutputSource = backgroundOutputEnabled ? await snapshotBackgroundOutput(page) : null;
				if (temperature === 'warm') {
					const data = page.waitForResponse(response => response.url().includes('/staged/elements/column/__data.json'));
					await link.hover();
					await data;
					await page.waitForLoadState('networkidle');
				}
				// Preserve normal focus/preload behavior; no extra settling wait is added.
				if (activation === 'enter') await link.focus();
				const profiler = process.env.SPATIAL_PERFORMANCE_PROFILE ? await context.newCDPSession(page) : undefined;
				if (profiler) { await profiler.send('Performance.enable'); await profiler.send('Profiler.enable'); await profiler.send('Profiler.start'); }
				const clockMetrics = profiler ? await profiler.send('Performance.getMetrics') : undefined;
				const profileStart = profiler ? await page.evaluate(() => performance.now()) : 0;
				await page.evaluate(async ({ view, idleBudget }) => {
					const times: number[] = [];
					for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(time => { times.push(time); resolve(); }));
					const gaps = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
					const source = view === 'list' ? document.querySelector<HTMLElement>('[data-catalog-card][data-spatial-element-id="column"] [data-shared-role="title"]')!
						: document.querySelector<HTMLElement>('[data-carousel-item="column"] .heading')!;
					const rect = source.getBoundingClientRect();
					const probe = { frames: [times[times.length - 1]], changed: 0, budget: idleBudget, sourceBudget: gaps[Math.floor(gaps.length / 2)], stop: false,
						assetsBefore: window.__stageVisualTest!.getCatalogStats() };
					const sample = (time: number) => {
						if (probe.stop) return;
						probe.frames.push(time);
						if (!probe.changed && document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase === 'moving') {
							const current = source.getBoundingClientRect();
							if (Math.abs(current.x - rect.x) + Math.abs(current.y - rect.y) > 0.5) probe.changed = performance.now();
						}
						requestAnimationFrame(sample);
					};
					Object.assign(window, { performanceProbe: probe }); requestAnimationFrame(sample);
				}, { view, idleBudget });
				let sourceActivity: unknown, activationObservation: ActivationObservation | null = null;
				if (activation === 'synthetic') {
					// Unchanged baseline: DOM activation avoids hover warming the cold case.
					// The original Click timestamp includes Kit's scheduling latency.
					sourceActivity = await link.evaluate((node: HTMLAnchorElement) => {
						const snapshot = window.__stageVisualTest?.getRenderActivity?.() ?? null;
						node.click();
						return snapshot;
					});
				} else {
					await link.evaluate((node: HTMLAnchorElement) => {
						const observation: ActivationObservation = { preActivationActivity: window.__stageVisualTest?.getRenderActivity?.() ?? null };
						Object.assign(window, { performanceActivation: observation });
						const record = (event: Event) => {
							if (!event.composedPath().includes(node)) return;
							const input = { observedAt: performance.now(), timeStamp: event.timeStamp, isTrusted: event.isTrusted };
							if (event instanceof PointerEvent) {
								const key = event.type === 'pointerdown' ? 'pointerDown' : 'pointerUp';
								observation[key] = { ...input, pointerType: event.pointerType };
							} else if (event instanceof KeyboardEvent && event.key === 'Enter') observation.keyDown = { ...input, key: event.key };
						};
						const clicked = (event: MouseEvent) => {
							if (!event.composedPath().includes(node)) return;
							observation.clickObservedAt = performance.now();
							observation.clickEventTimeStamp = event.timeStamp;
							observation.isTrusted = event.isTrusted;
							observation.clickDetail = event.detail;
							observation.clickActivity = window.__stageVisualTest?.getRenderActivity?.() ?? null;
							for (const type of ['pointerdown', 'pointerup', 'keydown']) window.removeEventListener(type, record, true);
							window.removeEventListener('click', clicked, true);
						};
						for (const type of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(type, record, true);
						window.addEventListener('click', clicked, true);
					});
					// Warm hover already positioned the mouse on the real link. Keep the
					// application's pointer press/release effects and preload listeners active.
					if (activation === 'pointer') { await page.mouse.down(); await page.mouse.up(); }
					else await page.keyboard.press('Enter');
					activationObservation = await page.evaluate(() => (window as unknown as { performanceActivation: ActivationObservation }).performanceActivation);
					sourceActivity = activationObservation.clickActivity;
				}
				await expect(page).toHaveURL(endpoint === 'dock' ? /\/staged\/elements\/column#reading$/ : /\/staged\/elements\/column$/);
				await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0)).toBeGreaterThan(0);
				// Capture the frame after the last reveal submission and let the
				// observer deliver its trailing Long Animation Frame entry.
				await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
				await expect.poll(() => page.evaluate(() => {
					const frames = (window as unknown as { performanceProbe: { frames: number[] } }).performanceProbe.frames;
					return (frames.at(-1) ?? 0) >= (window.__stageVisualTest?.getNavigationTimings().early?.revealEnded ?? Infinity);
				})).toBe(true);
				const result = await page.evaluate(() => {
					const timings = window.__stageVisualTest!.getNavigationTimings().early!;
					const probe = (window as unknown as { performanceProbe: { frames: number[]; changed: number; budget: number; sourceBudget: number; stop: boolean; assetsBefore: unknown } }).performanceProbe;
					const work = (window as unknown as { performanceWork: { adapter: Record<string, string>; longFrames: { startTime: number; duration: number }[]; gpuCalls: { method: string; time: number; phase?: string }[] } }).performanceWork;
					const input = (window as unknown as { performanceActivation?: ActivationObservation }).performanceActivation;
					const inputStart = input?.pointerDown?.timeStamp ?? input?.keyDown?.timeStamp;
					const inputEnd = input?.clickEventTimeStamp;
					// Press/focus preparation precedes the existing Click-based interval.
					// Keep its work separate; a GPU call at Click belongs to the old field.
					const inputPreparation = typeof inputStart === 'number' && typeof inputEnd === 'number' &&
						Number.isFinite(inputStart) && Number.isFinite(inputEnd) && inputEnd >= inputStart ? {
							start: inputStart, end: inputEnd, duration: inputEnd - inputStart,
							gpuCalls: work.gpuCalls.filter(call => call.time >= inputStart && call.time < inputEnd),
							longFrames: work.longFrames.filter(entry => entry.startTime + entry.duration > inputStart && entry.startTime < inputEnd)
						} : null;
					probe.stop = true;
					return { latency: timings.firstMotion - timings.started, submitted: timings.firstSubmitted - timings.started,
						observedDomChange: probe.changed - timings.started, budget: probe.budget, sourceBudget: probe.sourceBudget, timings,
						inputPreparation,
						assetsBefore: probe.assetsBefore, assetsAfter: window.__stageVisualTest!.getCatalogStats(), adapter: work.adapter,
						frames: probe.frames, gaps: probe.frames.slice(1).map((time, index) => time - probe.frames[index]),
						longFrames: work.longFrames.filter(entry => entry.startTime + entry.duration >= timings.started && entry.startTime <= timings.revealed),
						gpuCalls: work.gpuCalls.filter(entry => entry.time >= timings.started && entry.time <= timings.revealed),
						requests: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/__data.json') || entry.name.includes('/nodes/')).map(entry => ({ name: entry.name, start: entry.startTime - timings.started, duration: entry.duration })) };
				});
				const backgroundOutputEvidence = backgroundOutputEnabled
					? { source: backgroundOutputSource, end: await snapshotBackgroundOutput(page) } : null;
				Object.assign(result, { sourceActivity, idleCalibration, measurementProtocol, activation, activationObservation,
					backgroundOutputVariant, backgroundOutputEvidence });
				results.push(result);
				if (profiler) {
					const { profile } = await profiler.send('Profiler.stop');
					await writeFile(testInfo.outputPath(`cpu-${sample}.json`), JSON.stringify({ profileStart, clockMetrics, timings: result.timings, profile }));
				}
				const previousErrors = testInfo.errors.length;
				if (backgroundOutputEvidence) {
					validateBackgroundOutput(backgroundOutputEvidence.source);
					validateBackgroundOutput(backgroundOutputEvidence.end);
					expect.soft(backgroundOutputEvidence.end.owner.targetTextureId, 'The Background owner must retain the same target across navigation')
						.toBe(backgroundOutputEvidence.source?.owner.targetTextureId);
				}
				if (activation !== 'synthetic') {
					expect.soft(activationObservation?.isTrusted).toBe(true);
					expect.soft(Number.isFinite(activationObservation?.clickObservedAt)).toBe(true);
					expect.soft(activationObservation?.clickEventTimeStamp).toBe(result.timings.started);
					if (activation === 'pointer') {
						expect.soft(activationObservation?.pointerDown).toMatchObject({ isTrusted: true, pointerType: 'mouse' });
						expect.soft(activationObservation?.pointerUp).toMatchObject({ isTrusted: true, pointerType: 'mouse' });
					} else expect.soft(activationObservation?.keyDown).toMatchObject({ isTrusted: true, key: 'Enter' });
				}
				const dataRequests = result.requests.filter(entry => entry.name.includes('/staged/elements/column/__data.json'));
				// Keep the complete planned sample set even when a measured gate fails.
				// Navigation/readiness errors above remain hard failures: there is then
				// no completed transition whose timing could be meaningfully recorded.
				expect.soft(dataRequests.length).toBeGreaterThan(0);
				if (temperature === 'cold') {
					expect.soft(dataRequests.every(entry => entry.start >= 0)).toBe(true);
					expect.soft(result.requests.some(entry => entry.name.includes('/nodes/') && entry.start >= 0)).toBe(true);
				} else {
					expect.soft(dataRequests.every(entry => entry.start + entry.duration < 0)).toBe(true);
					expect.soft(result.requests.filter(entry => entry.name.includes('/nodes/')).every(entry => entry.start + entry.duration < 0)).toBe(true);
				}
				expect.soft(errors).toEqual([]);
				expect.soft(result.gpuCalls.filter(call => call.phase === 'moving')).toEqual([]);
				expect.soft(result.gpuCalls.filter(call => call.time <= result.timings.motionEnded)).toEqual([]);
				expect.soft(result.gpuCalls.filter(call => call.time >= result.timings.revealStarted && call.time <= result.timings.revealEnded)).toEqual([]);
				Object.assign(result, { validationErrors: testInfo.errors.slice(previousErrors).map(error => error.message) });
				await writeFile(testInfo.outputPath('samples.json'), JSON.stringify({ view, endpoint, temperature, samples, measurementProtocol, activation, backgroundOutputVariant,
					completedSamples: results.length, profiled: Boolean(process.env.SPATIAL_PERFORMANCE_PROFILE), results }, null, 2));
			} finally { await context.close(); }
		}
		const report = { view, endpoint, temperature, samples, measurementProtocol, activation, backgroundOutputVariant, completedSamples: results.length, profiled: Boolean(process.env.SPATIAL_PERFORMANCE_PROFILE), userAgent: browser.version(),
			machine: { platform: platform(), release: release(), cpu: cpus()[0]?.model }, viewport: { width, height: 1000, deviceScaleFactor: 1 },
			firstMotionP95: percentile(results.map(result => result.latency), 0.95),
			firstSubmitP95: percentile(results.map(result => result.submitted), 0.95),
			observedDomChangeP95: percentile(results.map(result => result.observedDomChange), 0.95), results };
		const path = testInfo.outputPath('measurements.json');
		await writeFile(path, JSON.stringify(report, null, 2));
		await testInfo.attach('measurements', { path, contentType: 'application/json' });
		expect(report.firstMotionP95).toBeLessThan(100);
		expect(report.firstSubmitP95).toBeLessThan(100);
		expect(report.observedDomChangeP95).toBeLessThan(100);
		expect(results.every(result => result.observedDomChange > 0)).toBe(true);
	});
}
