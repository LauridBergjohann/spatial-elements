import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const selected = '[data-carousel-item="column"] .spatial-element-target';
async function source(page: Page, staged = true) {
	await page.goto(`/demo/categories/carousel?stage-test=1${staged ? '&stagedNavigation=1' : ''}`);
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady))).toBe(true);
	await idle(page);
}
async function idle(page: Page) {
	await expect.poll(() => page.evaluate(() => {
		const state = window.__stageVisualTest?.getRenderActivity();
		return Boolean(state && !state.pendingRenderFrame && !state.animationActive && !state.catalogAnimating && !state.catalog?.preparing);
	})).toBe(true);
}

for (const staged of [true, false]) test(`programmatic Carousel link retains immediate DOM focus and navigates (staged ${staged})`, async ({ page }) => {
	await source(page, staged);
	const result = await page.evaluate(selector => {
		const link = document.querySelector<HTMLAnchorElement>(selector)!;
		const before = window.__stageVisualTest!.getRenderActivity()!;
		link.click();
		return { focused: document.activeElement === link, visibleFocus: link.matches(':focus-visible'),
			beforePending: before.pendingRenderFrame, afterPending: window.__stageVisualTest!.getRenderActivity()!.pendingRenderFrame };
	}, selected);
	expect(result).toEqual({ focused: true, visibleFocus: true, beforePending: false, afterPending: false });
	await expect(page).toHaveURL(/\/demo\/elements\/column$/);
	await expect(page.locator('[data-spatial-element-root]')).toBeVisible();
	if (staged) await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0)).toBeGreaterThan(0);
	else expect(await page.evaluate(() => window.__stageVisualTest?.getNavigationTimings().early)).toBeUndefined();
});

for (const staged of [true, false]) test(`late DOM veto receives the next regular focus frame (staged ${staged})`, async ({ page }) => {
	await source(page, staged);
	const result = await page.evaluate(async selector => {
		const api = window.__stageVisualTest!, link = document.querySelector<HTMLAnchorElement>(selector)!;
		// Registered after the action's focus listener, but before Kit's ancestor handler.
		link.addEventListener('click', event => event.preventDefault(), { once: true });
		const before = api.getRenderActivity()!;
		link.click();
		const immediate = { focused: document.activeElement === link, pending: api.getRenderActivity()!.pendingRenderFrame };
		await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
		const queued = api.getRenderActivity()!;
		await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
		return { immediate, beforeFrame: before.lastFrameAt, queuedFrame: queued.lastFrameAt,
			queued: queued.pendingRenderFrame, afterFrame: api.getRenderActivity()!.lastFrameAt,
			hover: api.getCarouselStats()!.actors.find(actor => actor.spatialElementId === 'column')!.hover };
	}, selected);
	expect(result.immediate).toEqual({ focused: true, pending: false });
	expect(result.queued).toBe(true);
	expect(result.queuedFrame).toBe(result.beforeFrame);
	expect(result.afterFrame).toBeGreaterThan(result.beforeFrame);
	expect(result.hover).toBeGreaterThan(0);
	await expect(page).toHaveURL(/\/demo\/categories\/carousel\?/);
	expect(await page.locator('.stage').getAttribute('data-catalog-staged-phase')).toBeNull();
});

test('Tab outline and warm pointer press retain their immediate GPU requests', async ({ page }) => {
	await source(page);
	await page.evaluate(selector => {
		const link = document.querySelector<HTMLAnchorElement>(selector)!;
		const predecessor = document.createElement('button');
		predecessor.textContent = 'Focus proof'; predecessor.style.position = 'absolute';
		link.before(predecessor); predecessor.focus();
		window.addEventListener('focusin', event => {
			if (event.target === link) Object.assign(window, { activationFocusTab: {
				focused: document.activeElement === link, visible: link.matches(':focus-visible'),
				pending: window.__stageVisualTest!.getRenderActivity()!.pendingRenderFrame } });
		});
	}, selected);
	await idle(page);
	await page.keyboard.press('Tab');
	expect(await page.evaluate(() => (window as any).activationFocusTab)).toEqual({ focused: true, visible: true, pending: true });
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!.actors.find(actor => actor.spatialElementId === 'column')!.hover)).toBeGreaterThan(0.9);
	await page.locator(selected).hover();
	await idle(page);
	await page.evaluate(selector => {
		const link = document.querySelector<HTMLAnchorElement>(selector)!;
		link.addEventListener('click', event => event.preventDefault(), { once: true });
		window.addEventListener('pointerdown', () => Object.assign(window, { activationFocusPress: {
			pending: window.__stageVisualTest!.getRenderActivity()!.pendingRenderFrame,
			pressed: window.__stageVisualTest!.getRenderActivity()!.catalog!.pointer.pressed } }), { once: true });
	}, selected);
	await page.mouse.down();
	expect(await page.evaluate(() => (window as any).activationFocusPress)).toEqual({ pending: true, pressed: true });
	await page.mouse.up();
	await expect(page).toHaveURL(/\/demo\/categories\/carousel\?/);
});

test('a neighbour click selects and focuses synchronously without becoming navigation', async ({ page }) => {
	await source(page);
	const result = await page.evaluate(() => {
		const link = [...document.querySelectorAll<HTMLAnchorElement>('.carousel-spatial-element:not(.selected) .spatial-element-target[role="button"]')]
			.find(candidate => !candidate.hidden && !candidate.closest<HTMLElement>('.carousel-spatial-element')!.hidden)!;
		if (!link) throw new Error('No resident carousel neighbour');
		const item = link.closest<HTMLElement>('[data-carousel-item]')!;
		link.click();
		return { id: item.dataset.carouselItem!, focused: document.activeElement === link,
			pending: window.__stageVisualTest!.getRenderActivity()!.pendingRenderFrame };
	});
	expect(result.focused).toBe(true);
	expect(result.pending).toBe(true);
	await expect(page.locator(`[data-carousel-item="${result.id}"]`)).toHaveClass(/selected/);
	await expect(page).toHaveURL(/\/demo\/categories\/carousel\?/);
});
