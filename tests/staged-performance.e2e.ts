import { expect, test } from '@playwright/test';
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

for (const view of ['list', 'carousel'] as const) for (const temperature of ['cold', 'warm'] as const) {
	test(`${width}px ${view} to ${endpoint}: ${samples} ${temperature} data and module navigations`, async ({ browser, baseURL }, testInfo) => {
		const results: { latency: number; submitted: number; observedDomChange: number; budget: number; gaps: number[]; timings: unknown; requests: { name: string; start: number; duration: number }[] }[] = [];
		for (let sample = 0; sample < samples; sample++) {
			const context = await browser.newContext({ baseURL, viewport: { width, height: 1000 } });
			try {
				const page = await context.newPage();
				// Measure display cadence before the application can saturate the GPU.
				// A slow source frame must not silently redefine a 60 Hz budget as 30 Hz.
				const idleBudget = await page.evaluate(async () => {
					const times: number[] = [];
					for (let i = 0; i < 12; i++) await new Promise<void>(resolve => requestAnimationFrame(time => { times.push(time); resolve(); }));
					const gaps = times.slice(1).map((time, index) => time - times[index]).sort((a, b) => a - b);
					return gaps[Math.floor(gaps.length / 2)];
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
				await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1`);
				await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
				const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
					: page.locator('[data-carousel-item="column"] .spatial-element-target');
				if (endpoint === 'hero') await link.evaluate((node: HTMLAnchorElement) => { const url = new URL(node.href); url.hash = ''; node.href = url.href; });
				await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
				if (temperature === 'warm') {
					const data = page.waitForResponse(response => response.url().includes('/staged/elements/column/__data.json'));
					await link.hover();
					await data;
					await page.waitForLoadState('networkidle');
				}
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
						if (document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase === 'moving') {
							const current = source.getBoundingClientRect();
							if (!probe.changed && Math.abs(current.x - rect.x) + Math.abs(current.y - rect.y) > 0.5) probe.changed = performance.now();
						}
						requestAnimationFrame(sample);
					};
					Object.assign(window, { performanceProbe: probe }); requestAnimationFrame(sample);
				}, { view, idleBudget });
				// DOM activation avoids hover warming the cold case. The original Click
				// event timestamp is still the start, including Kit's scheduling latency.
				await link.evaluate((node: HTMLAnchorElement) => node.click());
				await expect(page).toHaveURL(endpoint === 'dock' ? /\/staged\/elements\/column#reading$/ : /\/staged\/elements\/column$/);
				await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0)).toBeGreaterThan(0);
				// Capture the frame after the last reveal submission and let the
				// observer deliver its trailing Long Animation Frame entry.
				await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
				const result = await page.evaluate(() => {
					const timings = window.__stageVisualTest!.getNavigationTimings().early!;
					const probe = (window as unknown as { performanceProbe: { frames: number[]; changed: number; budget: number; sourceBudget: number; stop: boolean; assetsBefore: unknown } }).performanceProbe;
					const work = (window as unknown as { performanceWork: { adapter: Record<string, string>; longFrames: { startTime: number; duration: number }[]; gpuCalls: { method: string; time: number; phase?: string }[] } }).performanceWork;
					probe.stop = true;
					return { latency: timings.firstMotion - timings.started, submitted: timings.firstSubmitted - timings.started,
						observedDomChange: probe.changed - timings.started, budget: probe.budget, sourceBudget: probe.sourceBudget, timings,
						assetsBefore: probe.assetsBefore, assetsAfter: window.__stageVisualTest!.getCatalogStats(), adapter: work.adapter,
						frames: probe.frames, gaps: probe.frames.slice(1).map((time, index) => time - probe.frames[index]),
						longFrames: work.longFrames.filter(entry => entry.startTime + entry.duration >= timings.started && entry.startTime <= timings.revealed),
						gpuCalls: work.gpuCalls.filter(entry => entry.time >= timings.started && entry.time <= timings.revealed),
						requests: performance.getEntriesByType('resource').filter(entry => entry.name.includes('/__data.json') || entry.name.includes('/nodes/')).map(entry => ({ name: entry.name, start: entry.startTime - timings.started, duration: entry.duration })) };
				});
				results.push(result);
				if (profiler) {
					const { profile } = await profiler.send('Profiler.stop');
					await writeFile(testInfo.outputPath(`cpu-${sample}.json`), JSON.stringify({ profileStart, clockMetrics, timings: result.timings, profile }));
				}
				await writeFile(testInfo.outputPath('samples.json'), JSON.stringify({ view, endpoint, temperature, samples,
					completedSamples: results.length, profiled: Boolean(process.env.SPATIAL_PERFORMANCE_PROFILE), results }, null, 2));
				const dataRequests = result.requests.filter(entry => entry.name.includes('/staged/elements/column/__data.json'));
				expect(dataRequests.length).toBeGreaterThan(0);
				if (temperature === 'cold') {
					expect(dataRequests.every(entry => entry.start >= 0)).toBe(true);
					expect(result.requests.some(entry => entry.name.includes('/nodes/') && entry.start >= 0)).toBe(true);
				} else {
					expect(dataRequests.every(entry => entry.start + entry.duration < 0)).toBe(true);
					expect(result.requests.filter(entry => entry.name.includes('/nodes/')).every(entry => entry.start + entry.duration < 0)).toBe(true);
				}
				expect(errors).toEqual([]);
				expect(result.gpuCalls.filter(call => call.phase === 'moving')).toEqual([]);
				expect(result.gpuCalls.filter(call => call.time <= result.timings.motionEnded)).toEqual([]);
				expect(result.gpuCalls.filter(call => call.time >= result.timings.revealStarted && call.time <= result.timings.revealEnded)).toEqual([]);
			} finally { await context.close(); }
		}
		const report = { view, endpoint, temperature, samples, completedSamples: results.length, profiled: Boolean(process.env.SPATIAL_PERFORMANCE_PROFILE), userAgent: browser.version(),
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
