import { expect, test, type CDPSession, type Locator, type Page } from '@playwright/test';

test.use({ hasTouch: true, isMobile: true, viewport: { width: 430, height: 900 } });

const selectedTarget = '[data-carousel-item].selected .spatial-element-target';
const opacity = (target: Locator) => target.evaluate((element) => {
	const panel = element.closest('[data-carousel-item]')!.querySelector<HTMLElement>('.summary')!;
	return Number(panel.style.getPropertyValue('--carousel-panel-opacity'));
});

async function exposedPoint(target: Locator) {
	return target.evaluate((element) => {
		const box = element.getBoundingClientRect();
		for (const yRatio of [0.45, 0.65, 0.25, 0.85, 0.1]) {
			const y = box.top + box.height * yRatio;
			for (let x = Math.min(innerWidth - 10, box.right - 5); x > Math.max(10, box.left); x -= 12) {
				if (y > 50 && y < innerHeight - 50 && element.contains(document.elementFromPoint(x, y))) return { x, y };
			}
		}
		throw new Error('Carousel target has no exposed touch point');
	});
}

async function prepare(page: Page) {
	await page.goto('/demo/categories/carousel?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const target = page.locator(selectedTarget);
	await expect(page.locator('[data-carousel-item].selected')).toHaveAttribute('data-catalog-model-ready', '');
	await expect.poll(() => opacity(target)).toBeCloseTo(1, 4);
	await target.scrollIntoViewIfNeeded();
	await page.evaluate(() => {
		const target = document.querySelector('.carousel-spatial-element.selected .spatial-element-target')!;
		const rect = target.getBoundingClientRect();
		window.scrollBy({ top: rect.top + rect.height / 2 - 540, behavior: 'instant' });
		window.addEventListener('pointercancel', (event) => {
			if (event.pointerType === 'touch') document.body.dataset.testNativeTouchCancel = 'true';
		}, { once: true });
	});
	await expect.poll(async () => (await target.boundingBox())!.y).toBeGreaterThan(200);
	await expect.poll(async () => (await target.boundingBox())!.y).toBeLessThan(600);
	const point = await exposedPoint(target);
	return { target, point, session: await page.context().newCDPSession(page) };
}

async function start(session: CDPSession, point: { x: number; y: number }) {
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1 }] });
}

async function move(page: Page, session: CDPSession, from: { x: number; y: number }, dx: number, dy: number, steps = 10) {
	for (let step = 1; step <= steps; step++) {
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchMove',
			touchPoints: [{ id: 1, x: from.x + dx * step / steps, y: from.y + dy * step / steps }]
		});
		await page.waitForTimeout(20);
	}
	return { x: from.x + dx, y: from.y + dy };
}

async function end(session: CDPSession) {
	await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

test('a diagonal finger drag rotates and scrolls the page together', async ({ page }) => {
	const { target, point, session } = await prepare(page);
	const initialOpacity = await opacity(target);
	const initialScroll = await page.evaluate(() => window.scrollY);
	await start(session, point);
	await move(page, session, point, -145, -190);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll + 70);
	await expect.poll(() => opacity(target)).toBeLessThan(initialOpacity - 0.5);
	await end(session);
	await expect(page).toHaveURL(/categories\/carousel/);
});

test('a vertical start keeps scrolling and can turn the carousel later in the same gesture', async ({ page }) => {
	const { target, point, session } = await prepare(page);
	const initialOpacity = await opacity(target);
	const initialScroll = await page.evaluate(() => window.scrollY);
	await start(session, point);
	const next = await move(page, session, point, 0, -110, 6);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll + 40);
	expect(await opacity(target)).toBeCloseTo(initialOpacity, 3);
	await move(page, session, next, -145, -40);
	await expect.poll(() => opacity(target)).toBeLessThan(initialOpacity - 0.5);
	await end(session);
});

test('a horizontal flick carries momentum after release and a subsequent tap selects a neighbour', async ({ page }) => {
	const { target, point, session } = await prepare(page);
	const firstItem = await target.locator('..').locator('..').getAttribute('data-carousel-item');
	const firstTarget = page.locator(`[data-carousel-item="${firstItem}"] .spatial-element-target`);
	await start(session, point);
	await move(page, session, point, -145, 0, 5);
	const beforeRelease = await opacity(firstTarget);
	await end(session);
	await expect.poll(() => opacity(firstTarget)).toBeLessThan(beforeRelease - 0.05);
	const nextItem = page.locator('[data-carousel-item]').nth(1);
	await expect(nextItem).toHaveClass(/selected/);
	await expect.poll(() => opacity(nextItem.locator('.spatial-element-target'))).toBeCloseTo(1, 3);
	const neighbour = page.locator('[data-carousel-item]').nth(2);
	const tap = await exposedPoint(neighbour.locator('.spatial-element-target'));
	await page.touchscreen.tap(tap.x, tap.y);
	await expect(neighbour).toHaveClass(/selected/);
});

test('a horizontal start can become a vertical scroll without lifting the finger', async ({ page }) => {
	const { target, point, session } = await prepare(page);
	const initialOpacity = await opacity(target);
	const initialScroll = await page.evaluate(() => window.scrollY);
	await start(session, point);
	const next = await move(page, session, point, -80, 0, 5);
	await expect.poll(() => opacity(target)).toBeLessThan(initialOpacity - 0.3);
	await move(page, session, next, -55, -160);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll + 50);
	await expect.poll(() => opacity(target)).toBeLessThan(initialOpacity - 0.5);
	await end(session);
});

test('a purely vertical swipe leaves the selection and carousel position unchanged', async ({ page }) => {
	const { target, point, session } = await prepare(page);
	const initialOpacity = await opacity(target);
	const initialScroll = await page.evaluate(() => window.scrollY);
	await start(session, point);
	await move(page, session, point, 0, -180);
	await end(session);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(initialScroll + 70);
	expect(await opacity(target)).toBeCloseTo(initialOpacity, 3);
	await expect(target).toHaveAttribute('aria-pressed', 'true');
});

test('mouse clicks and dragging still select carousel items on a hybrid device', async ({ page }) => {
	await prepare(page);
	const second = page.locator('[data-carousel-item]').nth(1);
	const click = await exposedPoint(second.locator('.spatial-element-target'));
	await page.mouse.click(click.x, click.y);
	await expect(second).toHaveClass(/selected/);
	await expect.poll(() => opacity(second.locator('.spatial-element-target'))).toBeCloseTo(1, 3);
	const point = await exposedPoint(second.locator('.spatial-element-target'));
	await page.mouse.move(point.x, point.y);
	await page.mouse.down();
	await page.mouse.move(point.x - 120, point.y, { steps: 8 });
	await page.mouse.up();
	await expect(second).not.toHaveClass(/selected/);
});

test('vertical momentum continues after release and stops as soon as another finger touches', async ({ page }) => {
	const { point, session } = await prepare(page);
	await start(session, point);
	await move(page, session, point, 0, -120, 6);
	await end(session);
	const released = await page.evaluate(() => window.scrollY);
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(released + 10);
	await start(session, { x: 8, y: 250 });
	const stopped = await page.evaluate(() => window.scrollY);
	await page.waitForTimeout(150);
	expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(stopped, 0);
	await end(session);
});

test('content outside the model keeps native vertical scrolling', async ({ page }) => {
	const { session } = await prepare(page);
	const panel = page.locator('[data-carousel-item].selected .summary');
	await panel.scrollIntoViewIfNeeded();
	const point = await panel.evaluate((element) => {
		const rect = element.getBoundingClientRect();
		return { x: rect.left + rect.width / 2, y: Math.min(innerHeight - 80, rect.top + 50) };
	});
	const before = await page.evaluate(() => window.scrollY);
	await start(session, point);
	await move(page, session, point, 0, -120, 8);
	await end(session);
	await expect(page.locator('body')).toHaveAttribute('data-test-native-touch-cancel', 'true');
	await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 30);
});

test('the carousel model surface still permits native two-finger page zoom', async ({ page }) => {
	const { target, session } = await prepare(page);
	const box = (await target.boundingBox())!;
	const center = { x: Math.max(120, Math.min(310, box.x + box.width / 2)), y: box.y + box.height / 2 };
	const points = (spread: number) => [
		{ id: 1, x: center.x - spread, y: center.y },
		{ id: 2, x: center.x + spread, y: center.y }
	];
	await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) });
	for (let step = 1; step <= 8; step++) {
		await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(30 + step * 8) });
		await page.waitForTimeout(20);
	}
	await end(session);
	await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBeGreaterThan(1.05);
});
