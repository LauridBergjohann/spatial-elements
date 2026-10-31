import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
const examples = Boolean(process.env.SPATIAL_PIPELINE_EXAMPLES);
const brand = examples ? 'watches' : 'demo', id = examples ? 'chronograph' : 'column';

for (const view of ['list', 'carousel']) {
	test(`${view} warms every pipeline variant before source motion`, async ({ page }, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.addInitScript(() => {
			const calls: unknown[] = [], shaders: unknown[] = [];
			const objects = new WeakMap<object, { id: number; type: string; hash?: string }>();
			let next = 1;
			const identify = (value: object) => {
				let identity = objects.get(value);
				if (!identity) { identity = { id: next++, type: value.constructor.name }; objects.set(value, identity); }
				return identity;
			};
			const hash = (value: string) => {
				let result = 2166136261;
				for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
				return `${value.length}:${result >>> 0}`;
			};
			const serialize = (value: unknown): unknown => {
				if (!value || typeof value !== 'object') return value;
				if (Array.isArray(value)) return value.map(serialize);
				// Three uses descriptor class instances; only opaque native GPU objects
				// should become references instead of losing their descriptor fields.
				if (!Object.keys(value).length && Object.getPrototypeOf(value) !== Object.prototype) return identify(value);
				return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, serialize(child)]));
			};
			const device = (globalThis as unknown as { GPUDevice?: { prototype: Record<string, (...args: any[]) => any> } }).GPUDevice;
			if (!device) return;
			for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createBuffer', 'createTexture']) {
				const original = device.prototype[method];
				device.prototype[method] = function (...args: any[]) {
					const phase = document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase;
					if (method === 'createShaderModule') {
						const result = original.apply(this, args), identity = identify(result);
						identity.hash = hash(args[0].code);
						shaders.push({ ...identity, phase, code: args[0].code });
						calls.push({ method, time: performance.now(), phase, descriptor: { ...identity } });
						return result;
					}
					calls.push({ method, time: performance.now(), phase, descriptor: serialize(args[0]), stack: new Error().stack });
					return original.apply(this, args);
				};
			}
			Object.assign(window, { stagedPipelines: { calls, shaders } });
		});
		await page.goto(`/${brand}/categories/${view}?stage-test=1&stagedNavigation=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const link = view === 'list' ? page.locator(`[data-catalog-card][data-spatial-element-id="${id}"]`).first()
			: page.locator(`[data-carousel-item="${id}"] .spatial-element-target`);
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
		if (examples && view === 'carousel') {
			await expect(page.locator(`[data-carousel-item="${id}"]`)).toHaveAttribute('data-carousel-surface', 'glass');
			await expect(page.locator(`[data-carousel-item="${id}"]`)).toHaveAttribute('data-carousel-glass-ready', '');
		}
		await link.hover();
		await expect.poll(() => page.evaluate(id => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === id && actor.stagedReady) ?? false, id)).toBe(true);
		await link.click();
		await expect(page).toHaveURL(new RegExp(`/${brand}/${examples ? 'products/' : 'elements/'}${id}$`));
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
		const result = await page.evaluate(() => ({ ...(window as any).stagedPipelines, timings: window.__stageVisualTest!.getNavigationTimings() }));
		const artifact = testInfo.outputPath('pipeline-descriptors.json');
		await writeFile(artifact, JSON.stringify(result, null, 2));
		await testInfo.attach('pipeline-descriptors', { path: artifact, contentType: 'application/json' });
		expect(result.timings.early?.firstMotion).toBeGreaterThan(0);
		expect(result.calls.filter((call: { phase?: string }) => call.phase === 'moving')).toEqual([]);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		expect(errors).toEqual([]);
	});
}
