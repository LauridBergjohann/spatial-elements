import { expect, test, type CDPSession, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });

type Point = { x: number; y: number; id?: number };

async function touch(cdp: CDPSession, type: string, points: Point[]) {
	await cdp.send('Input.dispatchTouchEvent', {
		type,
		touchPoints: points.map((point, index) => ({ ...point, id: point.id ?? index + 1, radiusX: 4, radiusY: 4 }))
	});
}

async function drag(page: Page, cdp: CDPSession, start: Point, dx: number, dy: number) {
	await touch(cdp, 'touchStart', [start]);
	for (let step = 1; step <= 12; step++) {
		await touch(cdp, 'touchMove', [{ x: start.x + dx * step / 12, y: start.y + dy * step / 12 }]);
		await page.waitForTimeout(20);
	}
	await touch(cdp, 'touchEnd', []);
}

async function modelPoint(page: Page) {
	return page.evaluate(() => {
		const rect = window.__stageVisualTest!.getModelRect()!;
		for (const [fx, fy] of [[0.5, 0.5], [0.5, 0.35], [0.35, 0.5], [0.65, 0.5]]) {
			const x = rect.x + rect.width * fx;
			const y = rect.y + rect.height * fy;
			if (x > 15 && x < innerWidth - 90 && y > 20 && y < innerHeight - 100 &&
				document.elementFromPoint(x, y)?.matches('.stage-webgpu-background')) return { x, y };
		}
		throw new Error(`No unobstructed model point in ${JSON.stringify(rect)}`);
	});
}

const orientation = (page: Page) => page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!.live);

async function expectRotation(page: Page, before: number[]) {
	await expect.poll(async () => Math.max(...(await orientation(page)).map((value, index) => Math.abs(value - before[index])))).toBeGreaterThan(0.02);
}

async function openDetail(page: Page) {
	await page.goto('/demo/elements/cube?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getModelRect()?.width ?? 0)).toBeGreaterThan(0);
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
}

async function projectedModelOrigin(page: Page) {
	return page.evaluate(() => {
		const projection = window.__stageVisualTest!.getDetailProjection('hero')!;
		return {
			x: (1 + projection[12] / projection[15]) * innerWidth / 2,
			y: (1 - projection[13] / projection[15]) * innerHeight / 2
		};
	});
}

async function expectTwoFingerPan(page: Page, spreadRatio: number, scrolled = false) {
	if (scrolled) await page.evaluate(() => scrollTo(0, 140));
	else await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.25 }));
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const initial = await page.evaluate(() => ({
		y: scrollY, width: window.__stageVisualTest!.getModelRect()!.width,
		orientation: window.__stageVisualTest!.getMinimapOrientation()!.live
	}));
	const center = await projectedModelOrigin(page);
	const cdp = await page.context().newCDPSession(page);
	const points = (progress: number) => {
		const spread = 36 * (1 + (spreadRatio - 1) * progress);
		const x = center.x + 48 * progress, y = center.y + 30 * progress;
		return [{ x: x - spread, y, id: 1 }, { x: x + spread, y, id: 2 }];
	};
	await touch(cdp, 'touchStart', points(0));
	for (let step = 1; step <= 12; step++) {
		await touch(cdp, 'touchMove', points(step / 12));
		await page.waitForTimeout(30);
	}
	// Keep both fingers down while the existing dolly damping settles. The
	// grabbed model point must follow their midpoint even as page reveal
	// changes the camera projection; pan must not turn into orbit rotation.
	await page.evaluate(() => window.__stageVisualTest!.settle(45));
	const moved = await projectedModelOrigin(page);
	expect(moved.x - center.x).toBeCloseTo(48, 0);
	expect(moved.y - center.y).toBeCloseTo(30, 0);
	await touch(cdp, 'touchEnd', []);
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const released = await projectedModelOrigin(page);
	expect(Math.hypot(released.x - moved.x, released.y - moved.y)).toBeLessThan(1);
	const final = await page.evaluate(() => ({
		y: scrollY, width: window.__stageVisualTest!.getModelRect()!.width,
		orientation: window.__stageVisualTest!.getMinimapOrientation()!.live,
		scale: visualViewport!.scale
	}));
	const ratio = final.width / initial.width;
	if (spreadRatio > 1) expect(ratio).toBeGreaterThan(1.1);
	else if (spreadRatio < 1) expect(ratio).toBeLessThan(0.9);
	else expect(ratio).toBeCloseTo(1, 1);
	expect(Math.max(...final.orientation.map((value, index) => Math.abs(value - initial.orientation[index])))).toBeLessThan(0.001);
	if (scrolled) expect(final.y).toBeLessThan(initial.y - 40);
	else expect(final.y).toBeLessThan(3);
	expect(final.scale).toBe(1);
	await cdp.detach();
}

for (const gesture of [
	{ name: 'at a fixed zoom', spread: 1, scrolled: false },
	{ name: 'while pinching in', spread: 1.2, scrolled: false },
	{ name: 'while pinching out', spread: 0.8, scrolled: false },
	{ name: 'while pinching in from a scrolled page', spread: 1.2, scrolled: true }
]) {
	test(`two fingers pan the model ${gesture.name}`, async ({ page }) => {
		await openDetail(page);
		await expectTwoFingerPan(page, gesture.spread, gesture.scrolled);
	});
}

test.describe('desktop touch navigation', () => {
	test.use({ isMobile: false, viewport: { width: 2560, height: 1000 } });
	for (const gesture of [{ name: 'at a fixed zoom', spread: 1 }, { name: 'while pinching out', spread: 0.8 }]) {
		test(`two fingers pan the split 3XL model ${gesture.name}`, async ({ page }) => {
			await openDetail(page);
			await expect(page.locator('[data-spatial-element-root]')).toHaveAttribute('data-spatial-detail-pane', '');
			await expectTwoFingerPan(page, gesture.spread);
		});
	}

	test('two fingers pan the fullscreen model while pinching in', async ({ page }) => {
		await page.addInitScript(() => {
			Object.defineProperty(Element.prototype, 'requestFullscreen', {
				configurable: true, value: () => Promise.reject(new Error('Fullscreen denied by fixture'))
			});
		});
		await openDetail(page);
		await page.getByRole('button', { name: 'Fullscreen', exact: true }).tap();
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
		await expectTwoFingerPan(page, 1.2);
	});
});

test('first model touch rotates, then background scroll works on the very next gesture', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await openDetail(page);
	const cdp = await page.context().newCDPSession(page);
	const before = await orientation(page);
	await drag(page, cdp, await modelPoint(page), 65, 45);
	await expectRotation(page, before);
	expect(await page.evaluate(() => scrollY)).toBeLessThan(3);
	await expect(page.locator('.stage-webgpu-background')).toHaveCSS('touch-action', 'manipulation');
	await drag(page, cdp, { x: 8, y: 700 }, 0, -280);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80);
	expect(errors).toEqual([]);
});

test('pinch can release one finger, continue rotating, then rotate again without a priming tap', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await openDetail(page);
	const cdp = await page.context().newCDPSession(page);
	const center = await modelPoint(page);
	const initialFocus = await page.evaluate(() => window.__stageVisualTest!.getState().focus);
	await touch(cdp, 'touchStart', [{ x: center.x - 18, y: center.y, id: 1 }]);
	await touch(cdp, 'touchStart', [{ x: center.x - 18, y: center.y, id: 1 }, { x: center.x + 18, y: center.y, id: 2 }]);
	for (let step = 1; step <= 10; step++) {
		const offset = 18 + step * 3;
		await touch(cdp, 'touchMove', [{ x: center.x - offset, y: center.y, id: 1 }, { x: center.x + offset, y: center.y, id: 2 }]);
		await page.waitForTimeout(20);
	}
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeGreaterThan(initialFocus + 0.01);
	// For a partial CDP touchEnd, list the contact being lifted.
	await touch(cdp, 'touchEnd', [{ x: center.x - 48, y: center.y, id: 1 }]);
	const remainingBefore = await orientation(page);
	for (let step = 1; step <= 8; step++) {
		await touch(cdp, 'touchMove', [{ x: center.x + 48 - step * 5, y: center.y + step * 2, id: 2 }]);
		await page.waitForTimeout(20);
	}
	await expectRotation(page, remainingBefore);
	await touch(cdp, 'touchEnd', []);
	await page.evaluate(() => window.__stageVisualTest!.settle(90));
	const before = await orientation(page);
	await drag(page, cdp, await modelPoint(page), -60, 30);
	await expectRotation(page, before);
	// Close-up navigation now owns the whole canvas. Restore the overview before
	// expecting an empty-background swipe to scroll the document again.
	await page.getByRole('button', { name: 'Detail view', exact: true }).tap();
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getState().focus)).toBeLessThan(0.001);
	await drag(page, cdp, { x: 8, y: 700 }, 0, -260);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(80);
	expect(errors).toEqual([]);
});

test('touch and pen never leave CSS hover while a real mouse still works', async ({ page }) => {
	await page.goto('/demo/categories/list?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const card = page.locator('[data-catalog-card]').first();
	await card.evaluate((element) => window.scrollBy({ top: element.getBoundingClientRect().top - 280, behavior: 'instant' }));
	await expect.poll(async () => (await card.boundingBox())!.y).toBeLessThan(400);
	const rect = await card.locator('h3').boundingBox();
	expect(rect).not.toBeNull();
	await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
	await expect(card).toHaveAttribute('data-mouse-hover', '');
	await page.touchscreen.tap(8, 700);
	await expect(page.locator('[data-mouse-hover]')).toHaveCount(0);
	await page.mouse.move(1, 1);
	await page.mouse.move(rect!.x + rect!.width / 2, rect!.y + rect!.height / 2);
	await expect(card).toHaveAttribute('data-mouse-hover', '');
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2, pointerType: 'pen' });
	await expect(page.locator('[data-mouse-hover]')).toHaveCount(0);
});

test('a scrolled pinch starts revealing immediately without duplicate dolly or projection jumps', async ({ page }) => {
	await openDetail(page);
	await page.evaluate(() => scrollTo(0, 140));
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const center = await modelPoint(page);
	const cdp = await page.context().newCDPSession(page);
	const points = (spread: number) => [{ x: center.x - spread, y: center.y, id: 1 }, { x: center.x + spread, y: center.y, id: 2 }];
	const initial = await page.evaluate(() => ({ y: scrollY, width: window.__stageVisualTest!.getModelRect()!.width }));
	await touch(cdp, 'touchStart', points(30));
	let previousWidth = initial.width;
	for (let step = 1; step <= 12; step++) {
		await touch(cdp, 'touchMove', points(30 + step * 0.5));
		await page.waitForTimeout(40);
		const sample = await page.evaluate(() => ({ y: scrollY, state: window.__stageVisualTest!.getState(), width: window.__stageVisualTest!.getModelRect()!.width }));
		if (step === 3) {
			expect(sample.y).toBeLessThan(initial.y - 2);
			expect(sample.state.uiOpacity).toBeLessThan(0.99);
		}
		// Page reveal and surface fade share one progress value, rather than
		// first restoring the main header and then hiding it again.
		expect(Math.abs(sample.state.uiOpacity - sample.y / initial.y)).toBeLessThan(0.06);
		expect(sample.width / previousWidth).toBeGreaterThan(0.97);
		expect(sample.width / previousWidth).toBeLessThan(1.09);
		previousWidth = sample.width;
	}
	await touch(cdp, 'touchEnd', []);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const final = await page.evaluate(() => ({ y: scrollY, width: window.__stageVisualTest!.getModelRect()!.width }));
	expect(final.y).toBeLessThan(initial.y - 40);
	expect(final.width / initial.width).toBeGreaterThan(1.1);
	expect(final.width / initial.width).toBeLessThan(1.4);
	expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
});
