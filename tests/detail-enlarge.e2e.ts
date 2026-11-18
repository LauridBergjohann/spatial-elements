import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function open(page: Page) {
	await page.goto('/demo/layout-pane?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
}
async function modelPoint(page: Page) {
	const r = await page.evaluate(() => window.__stageVisualTest!.getModelRect()!);
	const viewport = page.viewportSize()!;
	return { x: (Math.max(0, r.x) + Math.min(viewport.width, r.x + r.width)) / 2,
		y: (Math.max(0, r.y) + Math.min(viewport.height, r.y + r.height)) / 2 };
}
const state = (page: Page) => page.evaluate(() => window.__stageVisualTest!.getState());

test('shallow zoom releases the wheel immediately outside the geometry', async ({ page }) => {
	await open(page);
	const point = await modelPoint(page);
	const ownership = await page.evaluate(({ x, y }) => {
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const send = (clientX: number, clientY: number, deltaY: number) => {
			const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX, clientY, deltaY });
			canvas.dispatchEvent(event); return event.defaultPrevented;
		};
		return [send(x, y, -12), send(2, 700, 50)];
	}, point);
	expect(ownership).toEqual([true, false]);
});

test('wheel zoom-out recenters the model even when the pointer changes sides', async ({ page }) => {
	await open(page);
	const initial = await modelPoint(page);
	await page.mouse.move(initial.x + 30, initial.y);
	await page.mouse.wheel(0, -700);
	await expect.poll(async () => (await state(page)).focus).toBeGreaterThan(0.01);
	const zoomed = await modelPoint(page);
	await page.mouse.move(zoomed.x - 30, zoomed.y);
	await page.mouse.wheel(0, 5000);
	await expect.poll(async () => (await state(page)).focus).toBeLessThan(0.001);
	await expect.poll(async () => Math.hypot((await modelPoint(page)).x - initial.x, (await modelPoint(page)).y - initial.y)).toBeLessThan(2);
});

for (const width of [430, 1700, 2400]) {
	test(`click enlarges and recenters the detail at ${width}px`, async ({ page }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		const initial = await modelPoint(page);
		await page.mouse.click(initial.x, initial.y);
		await expect.poll(async () => (await state(page)).uiOpacity).toBeLessThan(0.001);
		await expect.poll(async () => (await state(page)).minimapFocus).toBeGreaterThan(0.999);
		await expect(page.locator('[data-spatial-detail-pane-body]')).toHaveAttribute('inert', '');
		await page.screenshot({ path: info.outputPath('enlarged.png') });
		// Enlargement uses the whole viewport, including the former content-pane area.
		await page.mouse.click(width / 2, 450);
		await expect.poll(async () => (await state(page)).focus).toBeLessThan(0.001);
		await expect(page.locator('[data-spatial-detail-pane-body]')).not.toHaveAttribute('inert', '');
		await expect.poll(async () => Math.hypot((await modelPoint(page)).x - initial.x, (await modelPoint(page)).y - initial.y)).toBeLessThan(2);
	});
}

test('3XL scrolling does not reset zoom and wheel input switches areas without an idle delay', async ({ page }) => {
	await page.setViewportSize({ width: 2400, height: 900 });
	await open(page);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.2 }));
	const before = await state(page);
	await page.mouse.move(2100, 500);
	await page.mouse.wheel(0, 240);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
	expect((await state(page)).focus).toBeCloseTo(before.focus, 3);
	const ownership = await page.evaluate(() => {
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const dispatch = (x: number, deltaY: number) => {
			const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: 450, deltaY });
			canvas.dispatchEvent(event); return event.defaultPrevented;
		};
		return [dispatch(2100, 40), dispatch(800, -40), dispatch(2100, 40), dispatch(800, 40)];
	});
	expect(ownership).toEqual([false, true, false, true]);
});

test('a real pointer click resets a still-moving wheel zoom without waiting for idle', async ({ page }) => {
	await open(page);
	const point = await modelPoint(page);
	await page.mouse.move(point.x, point.y);
	await page.mouse.wheel(0, -700);
	await page.mouse.click(point.x, point.y);
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	await expect.poll(async () => (await state(page)).focus).toBeLessThan(0.001);
	await expect.poll(async () => Math.hypot((await modelPoint(page)).x - point.x, (await modelPoint(page)).y - point.y)).toBeLessThan(2);
});

test('one click completes the reset while the previous wheel burst is still delivering events', async ({ page }) => {
	await open(page);
	const initial = await page.evaluate(() => window.__stageVisualTest!.getModelRect()!);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.3 }));
	const point = await modelPoint(page);
	await page.mouse.move(point.x, point.y);
	await page.mouse.wheel(0, -300);
	await page.mouse.click(point.x, point.y);
	// Physical wheels/trackpads can finish their inertial stream after pointerup.
	await page.evaluate(({ x, y }) => {
		for (const delay of [0, 30, 80]) setTimeout(() => {
			document.querySelector('.stage-webgpu-background')!.dispatchEvent(new WheelEvent('wheel', {
				bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: -30
			}));
		}, delay);
	}, point);
	await expect.poll(async () => page.evaluate(initial => {
		const current = window.__stageVisualTest!.getModelRect()!;
		return Math.max(...(['x', 'y', 'width', 'height'] as const).map(key => Math.abs(current[key] - initial[key])));
	}, initial)).toBeLessThan(2);
});

test('sections keep their gap to the projected submenu and nearby sections blur', async ({ page }) => {
	await page.setViewportSize({ width: 1700, height: 900 });
	await open(page);
	const read = () => page.evaluate(() => {
		const frame = document.querySelector('[data-spatial-element-tabs-panel-anchor] [data-stage-panel-fallback]') as HTMLElement;
		const panel = window.__stageVisualTest!.getPanelRect(frame)!;
		const list = document.querySelector('.spatial-element-section-list')!;
		const section = list.querySelector('[data-spatial-element-section-near-viewport]')!;
		return { gap: list.getBoundingClientRect().top - panel.y - panel.height, blur: getComputedStyle(section).filter };
	});
	const initial = await read();
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45 }));
	const zoomed = await read();
	expect(zoomed.gap).toBeCloseTo(initial.gap, 0);
	expect(zoomed.blur).toMatch(/^blur\(/);
});

test('3XL pane corner keeps its distance to the projected control row', async ({ page }) => {
	await page.setViewportSize({ width: 2400, height: 900 });
	await open(page);
	const gap = () => page.evaluate(() => {
		const frames = Array.from(document.querySelectorAll<HTMLElement>('[data-spatial-element-tools] [data-stage-panel-fallback]'));
		const controls = frames.map(frame => window.__stageVisualTest!.getPanelRect(frame)).filter(rect => rect !== null);
		const control = controls.sort((a, b) => b!.x - a!.x)[0]!;
		const pane = document.querySelector('[data-spatial-detail-pane-header]')!.getBoundingClientRect();
		return { x: pane.x - control.x - control.width, y: pane.y - control.y };
	});
	const rest = await gap();
	for (const zoom of [0.3, 0.45, 0.6]) {
		await page.evaluate(zoom => window.__stageVisualTest!.setView({ zoom }), zoom);
		const current = await gap();
		expect(current.x).toBeCloseTo(rest.x, 0);
		expect(current.y).toBeCloseTo(rest.y, 0);
	}
});

for (const phase of ['partial', 'complete']) {
	test(`zoom-out during ${phase} panel clearance keeps the empty-background gesture until the 380ms idle boundary`, async ({ page }) => {
		await open(page);
		await page.evaluate(async phase => {
			const stage = window.__stageVisualTest!;
			if (phase === 'complete') await stage.setView({ zoom: 0.9 });
			else {
				// Find the beginning of the actual fade, independent of the fixture's
				// fitted camera range. A small dolly may still leave panels unchanged.
				for (let step = 1; step <= 18; step++) {
					await stage.setView({ zoom: step * 0.05 }, 2);
					if (stage.getState().uiOpacity < 0.98) break;
				}
				await stage.settle(30);
			}
		}, phase);
		const before = await state(page);
		expect(before.uiOpacity).toBeLessThan(1);
		if (phase === 'partial') expect(before.uiOpacity).toBeGreaterThan(0.5);
		const prevented = await page.evaluate(() => {
			const canvas = document.querySelector('.stage-webgpu-background')!;
			// Even a fresh burst on the empty stage zooms from the start of fading.
			const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: 5, clientY: 600, deltaY: 5000 });
			canvas.dispatchEvent(event); return event.defaultPrevented;
		});
		expect(prevented).toBe(true);
		await expect.poll(async () => (await state(page)).focus).toBeLessThan(0.001);
		await page.waitForTimeout(390);
		await page.mouse.move(5, 600);
		await page.mouse.wheel(0, 120);
		await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
	});
}

test.describe('touch enlargement', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });
	test('tap from a scrolled page clears UI and returns to the centered overview', async ({ page }) => {
		await open(page);
		await page.evaluate(() => scrollTo(0, 80));
		await page.evaluate(() => window.__stageVisualTest!.settle(30));
		const point = await modelPoint(page);
		await page.touchscreen.tap(point.x, point.y);
		await expect.poll(async () => (await state(page)).uiOpacity).toBeLessThan(0.001);
		await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(1);
		const enlarged = await modelPoint(page);
		await page.touchscreen.tap(enlarged.x, enlarged.y);
		await expect.poll(async () => (await state(page)).focus).toBeLessThan(0.001);
	});
});

test('stacked sections move down and nearby content and breadcrumbs blur with zoom', async ({ page }) => {
	await page.setViewportSize({ width: 700, height: 900 });
	await open(page);
	const extent = await page.evaluate(() => document.documentElement.scrollHeight);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45 }));
	expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(extent + 1);
	const styles = await page.evaluate(() => {
		const list = document.querySelector('.spatial-element-section-list')!;
		const root = document.querySelector('[data-spatial-element-root]')!;
		const breadcrumb = document.querySelector('.spatial-element-hero')!.parentElement!.parentElement!.querySelector('.breadcrumbs')!;
		return { travel: parseFloat(getComputedStyle(root).getPropertyValue('--spatial-detail-content-fallback-travel')),
			translate: getComputedStyle(list).translate, blur: getComputedStyle(breadcrumb).filter,
			sectionBlur: getComputedStyle(root).getPropertyValue('--spatial-detail-content-blur') };
	});
	expect(styles.travel).toBeGreaterThan(0);
	expect(styles.translate).not.toBe('0px');
	expect(styles.blur).toMatch(/^blur\([1-9.\d]+px\)$/);
	expect(styles.sectionBlur).toMatch(/^blur\(/);
});
