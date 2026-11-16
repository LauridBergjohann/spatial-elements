import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function open(page: Page) {
	await page.goto('/demo/layout-pane?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
}
const focus = (page: Page) => page.evaluate(() => window.__stageVisualTest!.getState().focus);

test('3XL pane actually blurs the canvas backdrop through its scroll clip', async ({ page }, info) => {
	await page.setViewportSize({ width: 2400, height: 900 });
	await open(page);
	// A deterministic high-frequency backdrop at the same paint depth as the
	// WebGPU canvas makes a broken Backdrop Root visible in pixels, not just CSS.
	await page.evaluate(() => {
		const canvas = document.querySelector('.stage-webgpu-background')!;
		const pattern = document.createElement('div');
		pattern.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;background:repeating-linear-gradient(90deg,#000 0px 4px,#fff 4px 8px)';
		canvas.after(pattern);
	});
	for (const chapter of [1, 2]) {
		await page.locator(`[data-spatial-element-tab-list] [href="#pane-chapter-${chapter}"]`).click();
		await expect.poll(async () => (await page.locator(`#pane-chapter-${chapter}`).boundingBox())!.y).toBeCloseTo(182, 0);
		const box = (await page.locator(`#pane-chapter-${chapter}`).boundingBox())!;
		const clip = { x: Math.round(box.x + box.width - 200), y: 420, width: 128, height: 64 };
		const contrast = async (blur: number) => {
			await page.locator('[data-spatial-element-root]').evaluate((node, value) => (node as HTMLElement).style.setProperty('--spatial-pane-blur', `${value}px`), blur);
			const pixels = await page.screenshot({ clip, path: info.outputPath(`chapter-${chapter}-blur-${blur}.png`) });
			await info.attach(`chapter-${chapter}-blur-${blur}`, { body: pixels, contentType: 'image/png' });
			return (await sharp(pixels).stats()).channels[0].stdev;
		};
		const sharpContrast = await contrast(0);
		const blurredContrast = await contrast(12);
		expect(sharpContrast).toBeGreaterThan(10);
		expect(blurredContrast).toBeLessThan(sharpContrast * 0.2);
	}
});

test('3XL content surfaces share theme opacity and one unclipped backdrop', async ({ page }, info) => {
	await page.setViewportSize({ width: 2400, height: 900 });
	await open(page);
	const styles = await page.evaluate(() => {
		const selectors = ['.spatial-element-pane-heading', '.spatial-element-panel .stage-panel-surface',
			'#pane-chapter-1 > .ps-section-surface', '#pane-chapter-2 > .ps-section-surface'];
		return selectors.map(selector => {
			const style = getComputedStyle(document.querySelector(selector)!);
			return { color: style.backgroundColor, blur: style.backdropFilter };
		});
	});
	for (const style of styles) {
		expect(style.color).toMatch(/\/ 0\.8\)/);
		expect(style.blur).toBe('none');
	}
	await expect(page.locator('.spatial-element-pane-surface')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	const themeBlur = await page.locator('[data-spatial-element-root]').evaluate(node => getComputedStyle(node).getPropertyValue('--spatial-pane-blur').trim());
	await expect(page.locator('.spatial-element-pane-surface')).toHaveCSS('backdrop-filter', `blur(${themeBlur})`);
	expect(styles[2].color).not.toBe(styles[3].color);
	await page.screenshot({ path: info.outputPath('pane-surfaces.png') });
});

for (const width of [430, 700]) {
	test(`compact summary joins the sections at ${width}px`, async ({ page }, info) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		await expect(page.locator('.spatial-element-panel')).toHaveCSS('border-bottom-left-radius', '0px');
		const gap = await page.evaluate(() => {
			const summary = document.querySelector('[data-spatial-summary-aside]')!.getBoundingClientRect();
			const sections = document.querySelector('.spatial-element-section-list')!.getBoundingClientRect();
			return sections.top - summary.bottom;
		});
		expect(Math.abs(gap)).toBeLessThan(1);
		await page.screenshot({ path: info.outputPath('joined-summary.png') });
	});
}

for (const width of [430, 700, 1700, 2400]) {
	test(`hidden detail UI releases the canvas at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await open(page);
		await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 1 }));
		await expect(page.locator('[data-spatial-detail-pane-body]')).toHaveAttribute('inert', '');
		await expect(page.locator('[data-spatial-element-media-rail]')).toHaveAttribute('inert', '');
		const point = { x: width * 0.7, y: 700 };
		expect(await page.evaluate(p => document.elementFromPoint(p.x, p.y)?.classList.contains('stage-webgpu-background'), point)).toBe(true);
		const before = await page.evaluate(() => window.__stageVisualTest!.getMinimapOrientation()!.live);
		await page.mouse.move(point.x, point.y);
		await page.mouse.down();
		await page.mouse.move(point.x - 80, point.y - 80, { steps: 8 });
		await page.mouse.up();
		await expect.poll(() => page.evaluate(before => Math.max(...window.__stageVisualTest!.getMinimapOrientation()!.live.map((n, i) => Math.abs(n - before[i]))), before)).toBeGreaterThan(0.01);
	});
}

test('trackpad pinch above the sections zooms through UI and reveals the page top', async ({ page }) => {
	await page.setViewportSize({ width: 700, height: 900 });
	await open(page);
	await page.evaluate(() => scrollTo(0, 160));
	await page.evaluate(() => window.__stageVisualTest!.settle(30));
	const initialScroll = await page.evaluate(() => scrollY);
	expect(initialScroll).toBeGreaterThan(100);
	await page.locator('[data-spatial-summary-root]').first().evaluate(node => {
		const box = node.getBoundingClientRect();
		node.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -100,
			clientX: box.x + 20, clientY: box.y + 20 }));
	});
	await expect.poll(() => focus(page)).toBeGreaterThan(0.1);
	await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(initialScroll - 30);
	expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
});

test('a wheel burst started on navigation stays with the document after entering the model', async ({ page }) => {
	await open(page);
	await page.locator('.ps-navigation').evaluate(node => node.dispatchEvent(new WheelEvent('wheel', {
		bubbles: true, cancelable: true, deltaY: 100, clientX: 10, clientY: 10
	})));
	const prevented = await page.locator('.stage-webgpu-background').evaluate(node => {
		const box = document.querySelector('.spatial-element-visual')!.getBoundingClientRect();
		const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100,
			clientX: box.x + box.width / 2, clientY: box.y + box.height / 2 });
		node.dispatchEvent(event);
		return event.defaultPrevented;
	});
	expect(prevented).toBe(false);
	expect(await focus(page)).toBeLessThan(0.001);
});

test.describe('touch pinch', () => {
	test.use({ viewport: { width: 700, height: 900 }, hasTouch: true, isMobile: true });
	test('two fingers on the media rail zoom the model, not the document', async ({ page, context }) => {
		await open(page);
		const box = (await page.locator('[data-spatial-element-media-rail]').boundingBox())!;
		const x = box.x + box.width / 2, y = box.y + box.height / 2;
		const cdp = await context.newCDPSession(page);
		const points = (distance: number) => [{ id: 1, x: x - distance, y }, { id: 2, x: x + distance, y }];
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(30) });
		for (let distance = 40; distance <= 140; distance += 10) {
			await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(distance) });
			await page.waitForTimeout(20);
		}
		await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect.poll(() => focus(page)).toBeGreaterThan(0.2);
		expect(await page.evaluate(() => visualViewport!.scale)).toBe(1);
		await cdp.detach();
	});
});

test('ordinary content suppresses page pinch while allowing normal scrolling', async ({ page }) => {
	await page.goto('/demo/layout-cards');
	const outcomes = await page.locator('.brand-stage-shell').evaluate(node => {
		const pinch = new WheelEvent('wheel', { ctrlKey: true, deltaY: -100, bubbles: true, cancelable: true });
		const scroll = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true });
		node.dispatchEvent(pinch); node.dispatchEvent(scroll);
		return { pinch: pinch.defaultPrevented, scroll: scroll.defaultPrevented };
	});
	expect(outcomes).toEqual({ pinch: true, scroll: false });
});
