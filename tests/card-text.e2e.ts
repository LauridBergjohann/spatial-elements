import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

const title = 'Multi-Kommunikations-Gateway mit zwei C-BUS-Schnittstellen und erweiterten Funktionen';
const eyebrow = 'MULTIGATE3 – Steuerung und Kommunikation für anspruchsvolle Anwendungen';

async function longText(page: Page) {
	await page.addInitScript(({ title, eyebrow }) => {
		// Exercise identical long content in both endpoints without changing the demo catalog.
		new MutationObserver(() => {
			for (const role of ['title', 'eyebrow']) {
				for (const node of document.querySelectorAll(`[data-spatial-element-id="column"][data-shared-role="${role}"]`)) {
					const text = role === 'title' ? title : eyebrow;
					if (node.textContent !== text) node.textContent = text;
				}
			}
		}).observe(document, { subtree: true, childList: true });
	}, { title, eyebrow });
}

for (const width of [1440, 768, 430]) {
	test(`cards reserve equal text space at ${width}px without WebGPU`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await longText(page);
		await page.goto('/demo/categories/list');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await expect(page.locator('[data-catalog-card][data-spatial-element-id="column"]')).toHaveAttribute('title', title);
		await expect(page.locator('[data-catalog-card][data-spatial-element-id="orb"]')).not.toHaveAttribute('title');
		const metrics = await page.locator('[data-catalog-card]').evaluateAll((cards) => cards.map((card) => {
			const heading = card.querySelector('h3')!;
			const kicker = card.querySelector<HTMLElement>('[data-shared-role="eyebrow"]')!;
			return {
				id: (card as HTMLElement).dataset.spatialElementId,
				height: (card as HTMLElement).offsetHeight,
				titleLines: heading.clientHeight / parseFloat(getComputedStyle(heading).lineHeight),
				eyebrowLines: kicker.clientHeight / parseFloat(getComputedStyle(kicker).lineHeight),
				titleClipped: heading.scrollHeight > heading.clientHeight,
				eyebrowClipped: kicker.scrollWidth > kicker.clientWidth
			};
		}));
		expect(new Set(metrics.map((card) => card.height)).size).toBe(1);
		for (const card of metrics) {
			expect(card.titleLines).toBeCloseTo(2, 1);
			expect(card.eyebrowLines).toBeCloseTo(1, 1);
		}
		expect(metrics.find((card) => card.id === 'column')).toMatchObject({ titleClipped: true, eyebrowClipped: true });
	});
}

test('raised, clipped card text crossfades into full detail text and back', async ({ page }, info) => {
	await longText(page);
	await page.goto('/demo/categories/list?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const card = page.locator('[data-catalog-card][data-spatial-element-id="column"]');
	const activation = { x: 240, y: 300 };
	await card.scrollIntoViewIfNeeded();
	await expect(card).toHaveAttribute('data-catalog-model-ready');
	await card.hover({ position: activation });
	await expect.poll(() => card.locator('h3').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m43)).toBe(64);
	await expect.poll(() => card.locator('[data-shared-role="eyebrow"]').evaluate((node) => new DOMMatrix(getComputedStyle(node).transform).m43)).toBe(40);
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!.actors.find(actor => actor.spatialElementId === 'column')?.modelDepth)).toBe(96);
	await expect.poll(() => card.locator('.spatial-element-card-surface').evaluate(node => getComputedStyle(node, '::after').opacity)).toBe('1');
	await page.screenshot({ path: info.outputPath('cards-hover.png') });
	await page.evaluate(() => {
		const state = { samples: [] as object[], source: undefined as object | undefined };
		Object.assign(window, { cardTextTest: state });
		document.addEventListener('click', (event) => {
			const card = (event.target as Element).closest('[data-catalog-card]');
			if (!card) return;
			const title = card.querySelector('h3')!;
			state.source = { width: getComputedStyle(title).width, rect: title.getBoundingClientRect().toJSON() };
		}, true);
		const sample = () => {
			const stage = document.querySelector<HTMLElement>('[data-catalog-transition]');
			for (const node of document.querySelectorAll<HTMLElement>('[data-catalog-actor-role="title"], [data-catalog-actor-role="eyebrow"]')) {
				const style = getComputedStyle(node);
				state.samples.push({
					direction: stage?.dataset.catalogDirection,
					role: node.dataset.catalogActorRole,
					variant: node.dataset.catalogActorVariant ?? 'source',
					clamp: style.webkitLineClamp,
					whiteSpace: style.whiteSpace,
					ellipsis: style.textOverflow,
					opacity: Number(style.opacity),
					width: style.width,
					rect: node.getBoundingClientRect().toJSON()
				});
			}
		};
		new MutationObserver(sample).observe(document.body, { childList: true, subtree: true });
		const frame = () => { sample(); requestAnimationFrame(frame); };
		requestAnimationFrame(frame);
	});
	await card.click({ position: activation });
	await expect(page).toHaveURL(/elements\/column/);
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
	const detail = page.locator('[data-spatial-element-hero-panel-content]');
	await expect(detail.locator('h1')).toHaveText(title);
	await expect(detail.locator('[data-shared-role="eyebrow"]')).toHaveText(eyebrow);
	const before = await detail.locator('h1').boundingBox();
	await detail.locator('h1').hover();
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const after = await detail.locator('h1').boundingBox();
	for (const key of ['x', 'y', 'width', 'height'] as const) expect(after![key]).toBeCloseTo(before![key], 0);
	await expect(detail.locator('h1')).toHaveCSS('transform', 'none');
	await expect(detail.locator('h1')).toHaveCSS('-webkit-line-clamp', 'none');
	await page.screenshot({ path: info.outputPath('detail-full-text.png') });
	await page.goBack();
	await expect(page).toHaveURL(/categories\/list/);
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
	const result = await page.evaluate(() => (window as any).cardTextTest);
	const first = result.samples.find((s: any) => s.direction === 'forward' && s.role === 'title' && s.variant === 'source');
	expect(first.clamp).toBe('2');
	expect(first.width).toBe(result.source.width);
	for (const key of ['x', 'y', 'width', 'height']) expect(first.rect[key]).toBeCloseTo(result.source.rect[key], 0);
	for (const direction of ['forward', 'return']) {
		const samples = result.samples.filter((s: any) => s.direction === direction);
		for (const role of ['title', 'eyebrow']) {
			const destinations = samples.filter((s: any) => s.role === role && s.variant === 'destination');
			expect(destinations.some((s: any) => s.opacity > 0 && s.opacity < 1)).toBe(true);
			const clipped = samples.filter((s: any) => s.role === role && s.variant === (direction === 'forward' ? 'source' : 'destination'));
			expect(clipped.length).toBeGreaterThan(0);
			for (const s of clipped) expect(role === 'title' ? s.clamp : s.whiteSpace).toBe(role === 'title' ? '2' : 'nowrap');
		}
	}
});

test('reduced motion keeps card text still', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/demo/categories/list');
	const card = page.locator('[data-catalog-card]').first();
	await card.hover();
	await expect(card.locator('h3')).toHaveCSS('transform', 'none');
	await expect(card.locator('[data-shared-role="eyebrow"]')).toHaveCSS('transform', 'none');
});
