import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function open(page: Page) {
	await page.goto('/demo/elements/torus-knot?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await page.mouse.move(1, 890);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
}

test('summary content follows its surface and the complete panel leaves with the hero', async ({ page }, info) => {
	await open(page);
	const originalTitle = await page.locator('[data-spatial-element-hero-panel-content] h1').boundingBox();
	const heroBottom = await page.locator('.spatial-element-hero').evaluate((hero) => hero.getBoundingClientRect().bottom + scrollY);
	for (const scroll of [100, 200, 350, 500, 850, 0]) {
		await page.evaluate((top) => window.scrollTo({ top, behavior: 'instant' }), scroll);
		await expect.poll(() => page.evaluate(() => scrollY)).toBe(scroll);
		await expect.poll(() => page.locator('.spatial-element-hero').evaluate((hero) => hero.getBoundingClientRect().bottom)).toBeCloseTo(heroBottom - scroll, 0);
		await page.evaluate(() => window.__stageVisualTest!.settle(60));
		const state = await page.evaluate(() => {
			const frame = document.querySelector<HTMLElement>('.spatial-element-panel')!;
			const panel = window.__stageVisualTest!.getPanelRect(frame)!;
			const content = document.querySelector<HTMLElement>('[data-spatial-element-hero-panel-content]')!;
			const title = content.querySelector('h1')!.getBoundingClientRect();
			const inset = Number.parseFloat(getComputedStyle(frame).getPropertyValue('--stage-panel-content-inset'));
			const clip = Number.parseFloat(content.style.clipPath.replace('inset(', '')) || 0;
			return { panel, inset, clip, title: title.toJSON(), content: content.getBoundingClientRect().toJSON(),
				heroBottom: document.querySelector('.spatial-element-hero')!.getBoundingClientRect().bottom };
		});
		expect(state.panel.y + state.panel.height).toBeLessThanOrEqual(state.heroBottom + 1);
		if (scroll === 100) {
			expect(state.panel.y).toBeCloseTo(104, 0);
			expect(state.clip).toBe(0);
		}
		if (scroll < 500) {
			expect(state.content.y - state.panel.y).toBeCloseTo(state.inset, 0);
			expect(state.content.height + state.inset * 2).toBeCloseTo(state.panel.height, 0);
		}
		if (scroll === 850) expect(state.panel.y + state.panel.height).toBeLessThan(0);
		if (scroll === 0) expect(state.title.y).toBeCloseTo(originalTitle!.y, 0);
		if ([100, 350, 500].includes(scroll)) await page.screenshot({ path: info.outputPath(`summary-scroll-${scroll}.png`) });
	}
});

test('summary height follows wrapped and dynamically changing content', async ({ page }, info) => {
	await open(page);
	const frame = page.locator('.spatial-element-panel');
	const before = (await frame.boundingBox())!.height;
	await page.locator('[data-spatial-element-hero-panel-content] h1').evaluate((title) => {
		title.textContent = 'Feldmodul mit Halbleiterrelais für EEV für erweiterte Funktionen und flexible Anwendungen';
	});
	await page.locator('[data-spatial-element-hero-panel-content] .feature-list').evaluate((list) => {
		for (let i = 0; i < 5; i++) {
			const item = list.children[0].cloneNode(true) as HTMLElement;
			item.textContent = 'Längere technische Eigenschaft mit zusätzlichen Informationen und mehreren umbrochenen Zeilen';
			list.append(item);
		}
	});
	await expect.poll(async () => (await frame.boundingBox())!.height).toBeGreaterThan(before + 100);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const rects = await page.evaluate(() => ({
		panel: window.__stageVisualTest!.getPanelRect(document.querySelector('.spatial-element-panel')!)!,
		action: document.querySelector('[data-spatial-element-hero-panel-content] .spatial-element-action')!.getBoundingClientRect().toJSON()
	}));
	expect(rects.action.bottom).toBeLessThan(rects.panel.y + rects.panel.height - 20);
	await page.screenshot({ path: info.outputPath('summary-long-content.png') });
	await page.locator('[data-spatial-element-hero-panel-content] h1').evaluate((title) => { title.textContent = 'Torus Knot'; });
	await page.locator('[data-spatial-element-hero-panel-content] .feature-list').evaluate((list) => {
		while (list.children.length > 2) list.lastElementChild!.remove();
	});
	await expect.poll(async () => (await frame.boundingBox())!.height).toBe(before);
});
