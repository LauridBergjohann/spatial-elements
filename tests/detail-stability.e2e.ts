import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';
import { resolveSpatialElementDockLayout } from '../packages/core/src/spatial-element/spatialElementDock';

test('GPU unavailable: section changes preserve document height and requested scroll position', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-docking');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const result = await page.evaluate(async () => {
		await document.fonts.ready;
		const height = document.documentElement.scrollHeight;
		const max = height - innerHeight;
		const samples = [];
		for (let y = 0; y < max; y += 97) {
			scrollTo({ top: y, behavior: 'instant' });
			await new Promise(resolve => setTimeout(resolve, 40));
			samples.push({ delta: Math.abs(scrollY - y), height: document.documentElement.scrollHeight });
		}
		return { height, samples };
	});
	for (const sample of result.samples) {
		expect(sample.delta).toBeLessThan(1);
		expect(Math.abs(sample.height - result.height)).toBeLessThan(1);
	}
});

for (const mode of ['immersive', 'fullscreen', '3XL'] as const) test(`trackpad pans the ${mode} stage in both screen axes`, async ({ page }) => {
	if (mode === '3XL') await page.setViewportSize({ width: 2400, height: 900 });
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	if (mode === 'fullscreen') {
		await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	}
	if (mode === 'immersive') {
		const rect = await page.evaluate(() => window.__stageVisualTest!.getModelRect()!);
		await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().uiOpacity)).toBeLessThan(0.001);
		await page.mouse.move(2, 450);
	}
	const result = await page.evaluate(async () => {
		const api = window.__stageVisualTest!;
		await api.settle(120);
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const send = (deltaX: number, deltaY: number, ctrlKey = false) => canvas.dispatchEvent(new WheelEvent('wheel', {
			clientX: 2, clientY: innerHeight / 2,
			deltaX, deltaY, ctrlKey, bubbles: true, cancelable: true
		}));
		const before = api.getModelRect()!;
		const focusBefore = api.getState().focus;
		send(32, 12);
		await api.settle(8);
		const after = api.getModelRect()!;
		return { before, after, focusBefore, focusAfter: api.getState().focus };
	});
	// The pan plane passes through Orbit's target; nearer corners of a 3D box
	// travel farther on screen. Both axes must move without another dolly.
	expect(result.before.x - result.after.x).toBeGreaterThan(15);
	expect(result.before.x - result.after.x).toBeLessThan(100);
	expect(result.before.y - result.after.y).toBeGreaterThan(10);
	expect(result.before.y - result.after.y).toBeLessThan(100);
	expect(result.focusAfter).toBeCloseTo(result.focusBefore, 5);
	expect(Math.abs(result.after.width / result.before.width - 1)).toBeLessThan(0.03);
});

test('vertical trackpad input scrolls immediately outside a shallow model', async ({ page }) => {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.1 }, 30));
	expect(await page.evaluate(() => window.__stageVisualTest!.getState().uiOpacity)).toBeGreaterThan(0.9);
	await page.mouse.move(2, 450);
	await page.mouse.wheel(12, 32);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
});

test('trackpad pinch and horizontal pan never disable subsequent vertical wheel zoom', async ({ page }) => {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const result = await page.evaluate(async () => {
		const api = window.__stageVisualTest!;
		await api.settle(40);
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const send = (deltaY: number, ctrlKey: boolean, deltaX = 0) => {
			const event = new WheelEvent('wheel', { bubbles: true, cancelable: true,
				clientX: innerWidth / 2, clientY: 450, deltaX, deltaY, ctrlKey });
			canvas.dispatchEvent(event);
			return event.defaultPrevented;
		};
		for (let i = 0; i < 12; i++) {
			send(i % 2 ? -26 : -24, true);
			await new Promise(resolve => setTimeout(resolve, 16));
		}
		await api.settle(100);
		const zoomed = api.getState();
		const beforePan = api.getModelRect()!;
		const panned = send(12, false, 32);
		await api.settle(8);
		const afterPan = api.getModelRect()!;
		const panFocus = api.getState().focus;
		for (let i = 0; i < 12; i++) {
			send(i % 2 ? 30 : 28, true);
			await new Promise(resolve => setTimeout(resolve, 16));
		}
		await api.settle(100);
		const overview = api.getState();
		const rect = api.getModelRect()!;
		const wheel = new WheelEvent('wheel', { bubbles: true, cancelable: true,
			clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2, deltaY: -20 });
		canvas.dispatchEvent(wheel);
		await api.settle(8);
		return { zoomed, panned, beforePan, afterPan, panFocus, overview, wheelPrevented: wheel.defaultPrevented,
			beforeWheel: rect, afterWheel: api.getModelRect()! };
	});
	expect(result.zoomed.uiOpacity).toBeLessThan(0.001);
	expect(result.panned).toBe(true);
	expect(Math.abs(result.afterPan.x - result.beforePan.x)).toBeGreaterThan(10);
	expect(result.panFocus).toBeCloseTo(result.zoomed.focus, 5);
	expect(result.overview.focus).toBeLessThan(0.001);
	expect(result.overview.uiOpacity).toBeGreaterThan(0.999);
	expect(result.wheelPrevented).toBe(true);
	// A small wheel step already enlarges the model, but remains below the
	// intentional rest-distance threshold where the UI's focus starts changing.
	expect(result.afterWheel.width).toBeGreaterThan(result.beforeWheel.width * 1.001);
});

for (const native of [true, false]) test(`fresh wheel input replaces document inertia without waiting (${native ? 'native momentum' : 'fallback'})`, async ({ page }) => {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const result = await page.evaluate(async native => {
		const api = window.__stageVisualTest!;
		await api.settle(30);
		const model = api.getModelRect()!;
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const send = (inside: boolean, deltaY: number, momentum: boolean) => {
			const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY,
				clientX: inside ? model.x + model.width / 2 : 1,
				clientY: inside ? model.y + model.height / 2 : 400 });
			Object.defineProperty(event, 'momentum', { value: native ? momentum : undefined });
			canvas.dispatchEvent(event);
			return event.defaultPrevented;
		};
		const first = send(false, -50, false);
		const tail = [40, 30, 20, 12, 8, 4, 2, 1].map(value => send(true, -value, true));
		const fresh = send(true, -35, false);
		return { first, tail, fresh };
	}, native);
	expect(result.first).toBe(false);
	expect(result.tail.every(prevented => !prevented)).toBe(true);
	expect(result.fresh).toBe(true);
});

for (const width of [390, 1200, 1920]) test(`minimap docks continuously in both directions at ${width}px`, async ({ page }) => {
	await page.setViewportSize({ width, height: 900 });
	await page.goto('/demo/layout-docking?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const dockTop = resolveSpatialElementDockLayout({ width, height: 900 })!.minimap.top;
	const samples = await page.evaluate(async dockTop => {
		const api = window.__stageVisualTest!;
		const start = api.getMinimapRect()!.y - dockTop;
		const results = [];
		for (const direction of [1, -1]) {
			const positions = Array.from({ length: 11 }, (_, i) => start - 5 + i);
			if (direction < 0) positions.reverse();
			const frames = [];
			for (const y of positions) {
				scrollTo({ top: y, behavior: 'instant' });
				await api.settle(4);
				frames.push({ model: api.getMinimapModelRect(), panel: api.getMinimapRect(),
					visible: api.getVisibilityStats().visibleMinimaps });
			}
			results.push(frames);
		}
		return results;
	}, dockTop);
	for (const frames of samples) for (let i = 0; i < frames.length; i++) {
		const current = frames[i];
		expect(current.visible).toBe(1);
		expect(current.model).not.toBeNull();
		if (!i) continue;
		const before = frames[i - 1].model!, after = current.model!;
		expect(Math.abs(after.y - before.y)).toBeLessThan(5);
		expect(Math.abs(after.height - before.height)).toBeLessThan(5);
	}
});

test('resizing a zoomed scrolled detail does not trigger an inward scroll gesture', async ({ page }) => {
	await page.setViewportSize({ width: 430, height: 800 });
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(async () => {
		await window.__stageVisualTest!.setView({ zoom: 0.2 }, 30);
		scrollTo({ top: 180, behavior: 'instant' });
		await window.__stageVisualTest!.settle(30);
	});
	const start = await page.evaluate(() => scrollY);
	for (const height of [840, 880, 900, 860, 800]) {
		await page.setViewportSize({ width: 430, height });
		await page.evaluate(() => window.__stageVisualTest!.settle(8));
		expect(await page.evaluate(() => scrollY)).toBeCloseTo(start, 0);
		expect(await page.evaluate(() => window.__stageVisualTest!.getMinimapModelRect()!.width)).toBeGreaterThan(1);
	}
});
