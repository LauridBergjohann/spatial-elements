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
