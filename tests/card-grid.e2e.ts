import { expect, test, type Page } from '@playwright/test';
import { resolveCardLayout, resolveContentGrid } from '@spatial-elements/core/spatial-element/responsiveLayout';

const cases = [
	{ id: 'cards-small', size: 's', align: 'start' },
	{ id: 'cards-medium', size: 'm', align: 'start' },
	{ id: 'cards-large', size: 'l', align: 'center' }
] as const;

test('shared card tone and editorial variant update the native grid and retain real links', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-cards');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	const card = page.locator('#cards-medium [data-catalog-card]').first();
	const surface = card.locator('[data-ps-card-part="surface"]');
	const standard = await surface.evaluate(node => getComputedStyle(node).backgroundColor);
	await page.getByLabel('Card tone').selectOption('muted');
	await expect(card).toHaveAttribute('data-tone', 'muted');
	await expect.poll(() => surface.evaluate(node => getComputedStyle(node).backgroundColor)).not.toBe(standard);
	await page.getByLabel('Card variant').selectOption('editorial');
	await expect(card).toHaveAttribute('data-card-variant', 'editorial');
	await expect(page.locator('#cards-medium .ps-content-block')).toHaveCount(6);
	await page.getByLabel('Media aspect').selectOption('3/2');
	const media = await card.locator('[data-ps-card-part="media-frame"]').boundingBox();
	expect(media!.width / media!.height).toBeCloseTo(1.5, 1);
	const link = card.getByRole('link');
	await expect(link).toHaveAttribute('data-catalog-view');
	await link.click();
	await expect(page).toHaveURL(/\/demo\/elements\//);
});

async function listMetrics(page: Page, id: string) {
	return page.locator(`#${id}`).evaluate((section) => {
		const catalog = section.querySelector<HTMLElement>('.catalog')!;
		const catalogStyle = getComputedStyle(catalog);
		return {
			containerWidth: section.getBoundingClientRect().width,
			gap: parseFloat(catalogStyle.columnGap),
			cards: Array.from(catalog.querySelectorAll<HTMLElement>('[data-catalog-card]'), (card) => {
				const geometry = card.querySelector<HTMLElement>('[data-ps-card-part="media"]')!;
				const copy = card.querySelector<HTMLElement>('[data-ps-card-part="copy"]')!;
				const heading = card.querySelector<HTMLElement>('h3')!;
				const eyebrow = card.querySelector<HTMLElement>('[data-ps-card-part="eyebrow"]:not([aria-hidden])');
				const rect = card.getBoundingClientRect();
				const mediaRect = geometry.getBoundingClientRect();
				const copyRect = copy.getBoundingClientRect();
				const headingRect = heading.getBoundingClientRect();
				const eyebrowRect = eyebrow?.getBoundingClientRect();
				const headingStyle = getComputedStyle(heading);
				return {
					id: card.dataset.spatialElementId,
					width: rect.width, height: rect.height, top: rect.top,
					media: { x: mediaRect.x - rect.x, y: mediaRect.y - rect.y, width: mediaRect.width, height: mediaRect.height },
					textHeight: copyRect.height,
					fontSize: parseFloat(headingStyle.fontSize),
					lineHeight: parseFloat(headingStyle.lineHeight),
					titleRows: headingRect.height / parseFloat(headingStyle.lineHeight),
					clamp: Number(headingStyle.webkitLineClamp),
					align: getComputedStyle(copy).textAlign,
					eyebrow: eyebrow ? { fontSize: parseFloat(getComputedStyle(eyebrow).fontSize), height: eyebrowRect!.height } : null,
					textTop: eyebrowRect?.top ?? headingRect.top,
					textBottom: headingRect.bottom,
					textCenter: ((eyebrowRect?.top ?? headingRect.top) + headingRect.bottom) / 2,
					copyTop: copyRect.top, copyBottom: copyRect.bottom, copyCenter: (copyRect.top + copyRect.bottom) / 2,
					mediaBottom: mediaRect.bottom,
					href: card.getAttribute('href'),
					posterFit: getComputedStyle(card.querySelector('img')!).objectFit
				};
			})
		};
	});
}

async function expectGridCards(page: Page) {
	for (const { id, size, align } of cases) {
		const metrics = await listMetrics(page, id);
		const grid = resolveContentGrid(metrics.containerWidth);
		const expected = resolveCardLayout(metrics.containerWidth, size, { reserveEyebrow: true });
		expect(metrics.cards).toHaveLength(6);
		expect(metrics.gap).toBe(grid.gap);
		for (const [index, card] of metrics.cards.entries()) {
			expect(Math.abs(card.width - expected.width), `${id} card width`).toBeLessThanOrEqual(1);
			expect(Math.abs(card.height - expected.height), `${id} card height`).toBeLessThanOrEqual(1);
			for (const key of ['x', 'y', 'width', 'height'] as const)
				expect(Math.abs(card.media[key] - expected.media[key]), `${id} media ${key}`).toBeLessThanOrEqual(1);
			expect(Math.abs(card.media.width - card.media.height)).toBeLessThanOrEqual(1);
			expect(Math.abs(card.textHeight - expected.textHeight)).toBeLessThanOrEqual(1);
			expect(card.fontSize).toBe(expected.titleSize);
			expect(card.lineHeight).toBe(expected.lineHeight);
			expect(card.clamp).toBe(expected.rows);
			expect(card.titleRows).toBeLessThanOrEqual(card.clamp + 0.05);
			expect(card.titleRows).toBeGreaterThanOrEqual(0.95);
			expect(card.align).toBe(align);
			expect(card.posterFit).toBe('contain');
			expect(new URL(card.href!, page.url()).pathname).toMatch(/^\/demo\/elements\//);
			expect(card.mediaBottom).toBeLessThanOrEqual(card.copyTop + 1);
			expect(card.textTop).toBeGreaterThanOrEqual(card.copyTop - 1);
			expect(card.textBottom).toBeLessThanOrEqual(card.copyBottom + 1);
			expect(card.textBottom).toBeCloseTo(card.copyBottom - 12, 0);
			if (size === 's' || index % 2 === 1) expect(card.eyebrow).toBeNull();
			else expect(card.eyebrow).toEqual({ fontSize: expected.eyebrowSize, height: expected.lineHeight });
		}
		const firstRow = metrics.cards.filter(card => Math.abs(card.top - metrics.cards[0].top) < 1);
		expect(firstRow).toHaveLength(Math.min(6, grid.columns / expected.span));
		if (size === 'l' && grid.size === 's') expect(firstRow).toHaveLength(2);
	}
}

for (const width of [320, 600, 840, 1200, 1700, 2300]) {
	test(`grid card allocations and text are coherent at ${width}px without WebGPU`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/demo/layout-cards');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
		await page.evaluate(() => document.fonts.ready);
		await expectGridCards(page);
	});
}

test('media and text geometry is already present in server HTML without JavaScript', async ({ browser, baseURL }) => {
	test.skip(Boolean(process.env.SPATIAL_E2E_DEV), 'Requires production CSS for server-only rendering');
	const context = await browser.newContext({ baseURL, javaScriptEnabled: false, viewport: { width: 320, height: 900 } });
	try {
		const page = await context.newPage();
		await page.goto('/demo/layout-cards');
		await expectGridCards(page);
		const column = page.locator('#cards-medium [data-catalog-card][data-spatial-element-id="column"]').first();
		await expect(column).toHaveAccessibleName(await column.locator('h3').innerText());
	} finally {
		await context.close();
	}
});

test('changing only the content container selects card spans independently of the viewport', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/demo/layout-cards');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
	for (const width of [599, 600, 839, 840, 1199, 1200]) {
		await page.locator('.content-page').evaluate((element, width) => {
			(element as HTMLElement).style.width = `${width}px`;
		}, width);
		await expectGridCards(page);
	}
});

test('media formats, filtering and keyed reorder preserve measured endpoints and equal heights', async ({ page }) => {
 await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
 await page.goto('/demo/layout-cards');
 const cards = page.locator('#cards-medium [data-catalog-card]');
 await expect(cards).toHaveCount(6);
 for (const aspect of ['1/1', '3/2', '4/3']) {
  await page.getByLabel('Media aspect').selectOption(aspect);
  const [x,y] = aspect.split('/').map(Number);
  await expect.poll(() => cards.first().locator('[data-ps-card-part="media-frame"]').evaluate(el => el.clientWidth / el.clientHeight)).toBeCloseTo(x/y, 1);
  const heights = await cards.evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height));
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(1);
 }
 const before = (await cards.first().boundingBox())!.height;
 const node = await cards.nth(1).elementHandle();
 await page.getByLabel('Only items without eyebrows').check();
 await expect(cards).toHaveCount(3);
 await expect.poll(async () => (await cards.first().boundingBox())!.height).toBeCloseTo(before - 20, 0);
 await page.getByLabel('Reverse items').check();
 expect(await node!.evaluate(el => el.isConnected)).toBe(true);
 await expect(cards.last()).toHaveAttribute('data-catalog-occurrence', JSON.stringify(['cards-medium','card-1']));
 for (const card of await cards.all()) await expect(card.locator('[data-catalog-geometry]')).toHaveCount(1);
});
