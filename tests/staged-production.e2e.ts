import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function readySource(page: import('@playwright/test').Page, view = 'carousel') {
	await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
	return view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
		: page.locator('[data-carousel-item="column"] .spatial-element-target');
}

async function expectEarlyReveal(page: import('@playwright/test').Page) {
	await expect.poll(() => page.evaluate(() => {
		const decision = document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision;
		return window.__stageVisualTest?.getNavigationTimings().early?.revealed ? 'revealed'
			: decision?.startsWith('cancelled:') ? 'cancelled' : 'pending';
	})).not.toBe('pending');
	const state = await page.evaluate(() => ({ timings: window.__stageVisualTest?.getNavigationTimings(),
		error: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedError }));
	expect(state.timings?.early?.revealed, JSON.stringify(state)).toBeGreaterThan(0);
}

async function expectHeldEndpointParity(page: import('@playwright/test').Page) {
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().restoring)).toBeGreaterThan(0);
	expect(await page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().bound)).toBe(0);
	await page.evaluate(() => {
		const api = window.__stageVisualTest!;
		const held = api.getSpatialCapture()!;
		if (!held) throw new Error('The committed destination lost its retained geometry');
		const probe = { held, bound: undefined as { projection: number[] } | undefined, width: innerWidth, height: innerHeight };
		Object.assign(window, { heldEndpointProbe: probe });
		const sample = () => {
			const phase = document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase;
			// Forward handoff disposes the capture at progress one. Its final
			// successor frame therefore belongs to the real detail renderer. The
			// reveal timestamp starts only in the hook which synchronously flushes
			// that owner; a later RAF cannot observe its pre-binding preparation.
			if ((phase === 'revealing' || phase === 'committing') && (api.getNavigationTimings().early?.revealStarted ?? 0) > 0) {
				const detail = document.querySelector('[data-spatial-element-root]');
				const kind = !detail?.hasAttribute('data-spatial-detail-pane') && detail?.hasAttribute('data-spatial-element-dock-active') ? 'dock' : 'hero';
				const projection = api.getDetailProjection(kind);
				if (projection) { probe.bound = { projection }; return; }
			}
			if (phase) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
		api.releasePageBinding();
	});
	await expect.poll(() => page.evaluate(() => Boolean((window as unknown as {
		heldEndpointProbe: { bound?: unknown }
	}).heldEndpointProbe.bound))).toBe(true);
	const result = await page.evaluate(() => {
		const probe = (window as unknown as { heldEndpointProbe: {
			held: { projection: number[] }; bound: { projection: number[] }; width: number; height: number;
		} }).heldEndpointProbe;
		const project = (matrix: number[], [x, y, z]: number[]) => {
			const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
			return [(1 + (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w) * probe.width / 2,
				(1 - (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w) * probe.height / 2];
		};
		return [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]].map(point => {
			const before = project(probe.held.projection, point), after = project(probe.bound.projection, point);
			return { point, before, after, error: Math.hypot(before[0] - after[0], before[1] - after[1]) };
		});
	});
	for (const entry of result) expect(entry.error, JSON.stringify(result)).toBeLessThanOrEqual(1);
}

for (const width of [430, 1440, 2456]) for (const view of ['list', 'carousel'] as const) {
	test(`${width}px ${view} moves the existing source before mounting the detail`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 1000 });
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.addInitScript(() => {
			const calls: { method: string; phase: string | undefined; time: number }[] = [];
			Object.assign(window, { stagedGpuCalls: calls });
			const device = (globalThis as unknown as { GPUDevice?: { prototype: Record<string, (...args: unknown[]) => unknown> } }).GPUDevice;
			for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createBuffer', 'createTexture']) {
				const original = device?.prototype[method];
				if (!original || !device) continue;
				device.prototype[method] = function (...args: unknown[]) {
					calls.push({ method, phase: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedPhase, time: performance.now() });
					return original.apply(this, args);
				};
			}
		});
		await page.goto(`/demo/categories/${view}?stage-test=1&stagedNavigation=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
			: page.locator('[data-carousel-item="column"] .spatial-element-target');
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
		await link.hover();
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
		await page.evaluate(view => {
			const source = view === 'list' ? document.querySelector<HTMLElement>('[data-catalog-card][data-spatial-element-id="column"]')!
				: document.querySelector<HTMLElement>('[data-carousel-item="column"] [data-spatial-presentation-root]')!;
			const root = document.querySelector<HTMLElement>('.stage')!;
			const frames: unknown[] = [];
			const changes: unknown[] = [];
			const originalWidth = source.offsetWidth;
			const observer = new MutationObserver(records => {
				if (root.dataset.catalogStagedPhase === 'moving') changes.push(...records.map(r => ({ added: r.addedNodes.length, removed: r.removedNodes.length })));
			});
			observer.observe(root, { childList: true, subtree: true });
			const sample = () => {
				const phase = root.dataset.catalogStagedPhase;
				if (phase) frames.push({ time: performance.now(), phase, sourceConnected: source.isConnected,
					width: source.offsetWidth, originalWidth, targetMounted: Boolean(document.querySelector('[data-spatial-element-root]')),
					geometry: window.__stageVisualTest!.getSpatialCapture(), sourceRect: source.getBoundingClientRect().toJSON() });
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
			Object.assign(window, { stagedProbe: { source, frames, changes, stop: () => observer.disconnect() } });
		}, view);
		await page.evaluate(() => window.__stageVisualTest!.holdNextPageBinding());
		await link.click();
		await expect(page).toHaveURL(/\/demo\/elements\/column$/);
		await expectHeldEndpointParity(page);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
		const probe = await page.evaluate(() => {
			const probe = (window as unknown as { stagedProbe: { frames: { phase: string; sourceConnected: boolean; targetMounted: boolean; width: number; originalWidth: number }[]; changes: unknown[]; stop(): void } }).stagedProbe;
			probe.stop();
			return { frames: probe.frames, changes: probe.changes, timings: window.__stageVisualTest!.getNavigationTimings(),
				decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogStagedDecision,
				gpuCalls: (window as unknown as { stagedGpuCalls: { method: string; phase?: string; time: number }[] }).stagedGpuCalls };
		});
		const path = testInfo.outputPath('staged-frames.json');
		await writeFile(path, JSON.stringify(probe, null, 2));
		await testInfo.attach('staged-frames', { path, contentType: 'application/json' });
		expect(errors).toEqual([]);
		const moving = probe.frames.filter(frame => frame.phase === 'moving');
		expect(moving.length).toBeGreaterThan(2);
		expect(moving.every(frame => frame.sourceConnected && !frame.targetMounted && frame.width === frame.originalWidth)).toBe(true);
		expect(probe.changes).toEqual([]);
		expect(probe.gpuCalls.filter(call => call.phase === 'moving')).toEqual([]);
		expect(probe.timings.early?.held).toBeGreaterThan(probe.timings.early?.firstMotion ?? Infinity);
		expect(probe.timings.early?.committed).toBeGreaterThanOrEqual(probe.timings.early?.held ?? Infinity);
		await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
		await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
	});
}

for (const interruption of ['Escape', 'wheel', 'resize'] as const) {
	test(`the live source is restored after ${interruption} interrupts slow navigation`, async ({ page }) => {
		let release!: () => void;
		const blocked = new Promise<void>(resolve => { release = resolve; });
		await page.route('**/staged/elements/*/__data.json*', async route => {
			const response = await route.fetch(); await blocked;
			await route.fulfill({ response }).catch(() => {});
		});
		try {
			const link = await readySource(page);
			const field = page.locator('[data-carousel-item="column"] textarea');
			await field.fill('Survives interruption');
			await field.evaluate(node => Object.assign(window, { interruptedField: node }));
			await link.evaluate((node: HTMLAnchorElement) => node.click());
			await expect(page.locator('.stage')).toHaveAttribute('data-catalog-staged-phase', 'held');
			await expect(page.locator('[data-spatial-element-root]')).toHaveCount(0);
			if (interruption === 'Escape') await page.keyboard.press('Escape');
			else if (interruption === 'wheel') await page.mouse.wheel(0, 30);
			else await page.setViewportSize({ width: 1200, height: 1000 });
			await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
			await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
			await expect(page).toHaveURL(/\/staged\/categories\/carousel\?/);
			expect(await field.evaluate(node => node === (window as unknown as { interruptedField: Node }).interruptedField)).toBe(true);
			await expect(field).toHaveValue('Survives interruption');
			expect(await field.evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
			release();
			await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		} finally { release(); }
	});
}

test('a slow server holds the same dock text until destination content can appear', async ({ page }) => {
	let release!: () => void;
	const blocked = new Promise<void>(resolve => { release = resolve; });
	await page.route('**/staged/elements/*/__data.json*', async route => {
		const response = await route.fetch(); await blocked; await route.fulfill({ response }).catch(() => {});
	});
	try {
		const link = await readySource(page);
		await link.evaluate((node: HTMLAnchorElement) => node.click());
		await expect(page.locator('.stage')).toHaveAttribute('data-catalog-staged-phase', 'held');
		await expect(page.locator('[data-spatial-element-root]')).toHaveCount(0);
		const title = page.locator('[data-catalog-staged-hold] .heading');
		await expect(title).toBeVisible();
		const box = (await title.boundingBox())!;
		expect(box.y).toBeLessThan(100);
		// A bounding box alone misses clipping by the stationary summary query.
		expect(await title.evaluate(node => {
			const rect = node.getBoundingClientRect();
			for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
				const css = getComputedStyle(parent), clip = parent.getBoundingClientRect();
				if (css.overflowX !== 'visible' && (rect.left < clip.left - 1 || rect.right > clip.right + 1)) return false;
				if (css.overflowY !== 'visible' && (rect.top < clip.top - 1 || rect.bottom > clip.bottom + 1)) return false;
			}
			return true;
		})).toBe(true);
		release();
		await expectEarlyReveal(page);
		await expect(page.locator('[data-spatial-element-sticky-header]')).toHaveAttribute('data-active', '');
	} finally { release(); }
});

test('reduced motion skips the artificial source movement interval', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const link = await readySource(page, 'list');
	await link.evaluate((node: HTMLAnchorElement) => node.click());
	await expectEarlyReveal(page);
	const timings = await page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().early!);
	expect(timings.held - timings.prepared).toBeLessThan(250);
	await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
});

test('Back during destination binding releases the hold without reviving obsolete owners', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.stack ?? error.message));
	const link = await readySource(page);
	await link.evaluate((node: HTMLAnchorElement) => node.click());
	await expect(page).toHaveURL(/\/staged\/elements\/column#reading$/);
	await page.evaluate(() => history.back());
	await expect(page).toHaveURL(/\/staged\/categories\/carousel\?/);
	await expect(page.locator('[data-carousel-item="column"] textarea')).toBeVisible();
	await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
	expect(errors).toEqual([]);
});

for (const interruption of ['Escape', 'wheel', 'resize'] as const) {
	test(`committed destination finishes binding after ${interruption} cancels its held source`, async ({ page }) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		const link = await readySource(page);
		const sourceField = page.locator('[data-carousel-item="column"] textarea');
		await sourceField.fill('Keep the committed configuration');
		await sourceField.evaluate(node => Object.assign(window, { committedSourceField: node }));
		await page.evaluate(() => window.__stageVisualTest!.holdNextPageBinding());
		await link.evaluate((node: HTMLAnchorElement) => node.click());
		await expect(page).toHaveURL(/\/staged\/elements\/column#reading$/);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().restoring)).toBeGreaterThan(0);
		expect(await page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().bound)).toBe(0);
		await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(1);
		await page.evaluate(kind => {
			const type = kind === 'Escape' ? 'keydown' : kind === 'wheel' ? 'wheel' : 'resize';
			window.addEventListener(type, () => {
				// Run after the bridge listener, before binding's awaited continuation.
				const heading = document.querySelector<HTMLElement>('#reading h2')!;
				heading.tabIndex = -1; heading.focus({ preventScroll: true });
				const intendedScroll = window.scrollY + 80;
				window.scrollTo({ top: intendedScroll, behavior: 'instant' });
				Object.assign(window, { lateInterruption: { heading, intendedScroll } });
			}, { once: true });
		}, interruption);
		if (interruption === 'Escape') await page.keyboard.press('Escape');
		else if (interruption === 'wheel') await page.mouse.wheel(0, 30);
		else await page.setViewportSize({ width: 1200, height: 1000 });
		// Interruption must release the artificial binding gate itself. Do not
		// navigate again or manually bind the page to make this assertion pass.
		await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().bound)).toBeGreaterThan(0);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
		await expect(page.locator('[data-spatial-presentation-frozen]')).toHaveCount(0);
		await expect(page.locator('[data-spatial-summary-root]')).toHaveCount(1);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getVisibilityStats().visibleMinimaps)).toBeGreaterThan(0);
		expect(await page.evaluate(() => {
			const probe = (window as unknown as { lateInterruption: { heading: HTMLElement; intendedScroll: number } }).lateInterruption;
			return { focus: document.activeElement === probe.heading, scroll: window.scrollY >= probe.intendedScroll - 1,
				inert: Boolean(probe.heading.closest('[inert]')), capture: Boolean(window.__stageVisualTest!.getSpatialCapture()) };
		})).toEqual({ focus: true, scroll: true, inert: false, capture: false });
		// The Dock intentionally hides the overview summary. Return using native
		// scroll only after proving cancellation preserved the user's prior position.
		await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
		const field = page.locator('[data-spatial-summary-root] textarea');
		await expect(field).toBeVisible();
		expect(await field.evaluate(node => node === (window as unknown as { committedSourceField: Node }).committedSourceField)).toBe(true);
		await expect(field).toHaveValue('Keep the committed configuration');
		await field.fill('Destination remains interactive');
		await expect(field).toHaveValue('Destination remains interactive');
		expect(errors).toEqual([]);
	});
}

test('a failed speculative data request falls back to usable ordinary navigation', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.route('**/staged/elements/column/__data.json*', route => route.abort('failed'), { times: 1 });
	const link = await readySource(page, 'list');
	await link.evaluate((node: HTMLAnchorElement) => node.click());
	await expect(page).toHaveURL(/\/staged\/elements\/column#reading$/);
	await expect(page.locator('[data-spatial-element-root]')).toBeVisible();
	await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-staged-phase', /.+/);
	expect(errors).toEqual([]);
});

for (const width of [430, 1440, 2456]) for (const view of ['list', 'carousel'] as const) {
	test(`${width}px ${view} uses the declared dock endpoint and retains summary state`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: 1000 });
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1`);
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
		const link = view === 'list' ? page.locator('[data-catalog-card][data-spatial-element-id="column"]').first()
			: page.locator('[data-carousel-item="column"] .spatial-element-target');
		if (view === 'carousel') {
			const field = page.locator('[data-carousel-item="column"] textarea');
			if (width >= 840) await field.fill('Preserved through the real dock navigation');
			await field.evaluate(node => Object.assign(window, { retainedDockField: node }));
		}
		if (width >= 2300) await page.evaluate(() => {
			const probe = { active: true, frames: [] as { phase: string; opacity: number; top: number; visible: boolean }[] };
			const sample = () => {
				if (!probe.active) return;
				const stage = document.querySelector<HTMLElement>('.stage')!;
				const shell = stage.querySelector<HTMLElement>('[data-catalog-shell]');
				if (stage.dataset.catalogStagedPhase && shell) {
					const style = getComputedStyle(shell);
					probe.frames.push({ phase: stage.dataset.catalogStagedPhase, opacity: Number(style.opacity),
						top: shell.getBoundingClientRect().top, visible: style.visibility !== 'hidden' });
				}
				requestAnimationFrame(sample);
			};
			Object.assign(window, { dockShellProbe: probe }); requestAnimationFrame(sample);
		});
		await link.hover();
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady) ?? false)).toBe(true);
		await page.evaluate(() => window.__stageVisualTest!.holdNextPageBinding());
		await link.click();
		await expect(page).toHaveURL(/\/staged\/elements\/column#reading$/);
		await expectHeldEndpointParity(page);
		await expectEarlyReveal(page);
		await expect(page.locator('.stage')).toHaveAttribute('data-catalog-staged-decision', 'accepted');
		await expect(page.locator('[data-catalog-staged-hold]')).toHaveCount(0);
		await expect(page.locator('#reading')).toBeInViewport();
		if (width < 2300) await expect(page.locator('[data-spatial-element-sticky-header]')).toHaveAttribute('data-active', '');
		else {
			await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane', '');
			expect((await page.locator('.spatial-element-visual').boundingBox())!.y).toBeCloseTo(96, 0);
			const frames = await page.evaluate(() => {
				const probe = (window as unknown as { dockShellProbe: { active: boolean; frames: { opacity: number; top: number; visible: boolean }[] } }).dockShellProbe;
				probe.active = false; return probe.frames;
			});
			expect(frames.length).toBeGreaterThan(2);
			expect(frames.every(frame => frame.opacity > 0.99 && frame.top >= 0 && frame.visible), JSON.stringify(frames)).toBe(true);
		}
		if (view === 'carousel') {
			expect(await page.locator('textarea').evaluate(node => node === (window as unknown as { retainedDockField: Node }).retainedDockField)).toBe(true);
			if (width >= 840) await expect(page.locator('textarea')).toHaveValue('Preserved through the real dock navigation');
		}
		const path = testInfo.outputPath('dock-timings.json');
		await writeFile(path, JSON.stringify(await page.evaluate(() => window.__stageVisualTest!.getNavigationTimings()), null, 2));
		await testInfo.attach('dock-timings', { path, contentType: 'application/json' });
		expect(errors).toEqual([]);
	});
}
