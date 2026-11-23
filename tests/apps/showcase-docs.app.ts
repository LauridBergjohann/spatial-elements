import { expect, test, type Locator, type Page } from '@playwright/test';

// Exercise the stage's visual scrolling through the same wheel input a reader uses.
// CDP's implicit scrollIntoView does not follow the enhanced document's visual offset.
async function reveal(page: Page, locator: Locator) {
	const viewport = page.viewportSize()!;
	await page.mouse.move(viewport.width / 2, viewport.height / 2);
	await expect.poll(async () => {
		const box = await locator.boundingBox();
		if (!box) return false;
		if (box.y >= 60 && box.y + box.height <= viewport.height - 40) return true;
		await page.mouse.wheel(0, Math.max(-650, Math.min(650, box.y + box.height / 2 - viewport.height / 2)));
		return false;
	}, { timeout: 20000, intervals: [200, 400, 500] }).toBe(true);
}

test('home selects the supplied WebP artwork for each theme', async ({ page }, info) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/');
	const artwork = page.locator('#welcome picture img');
	for (const mode of ['Dark', 'Light']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.currentSrc)).toContain(`/assets/website/hero-${mode.toLowerCase()}.webp`);
		await expect.poll(() => artwork.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth)).toBe(1536);
		await page.screenshot({ path: info.outputPath(`home-${mode}.png`) });
	}
});

test('learning path introduces the foundation before page and element data', async ({ page }, info) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	const paths = ['/docs/', '/docs/foundations/', '/docs/foundations/page-sections/', '/docs/foundations/first-experience/', '/docs/foundations/page-shell/', '/docs/foundations/assets/', '/docs/foundations/layout/', '/docs/sections/', '/docs/sections/composition/', '/docs/sections/card-grid/', '/docs/sections/carousel/'];
	await page.goto(paths[0]);
	for (const path of paths.slice(1)) {
		const next = page.getByRole('navigation', { name: 'Reading order' }).locator('[rel=next]');
		await expect(next).toHaveAttribute('href', path);
		await next.click();
		await expect(page).toHaveURL(new RegExp(path + '$'));
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/docs/foundations/page-shell/');
	await expect(page.locator('figure img')).toBeVisible();
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await page.screenshot({ path: info.outputPath('learning-path-mobile.png'), fullPage: true });
});

test('property links lead to nested fields and types are searchable', async ({ page }, info) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/docs/foundations/assets/');
	await page.locator('#required-fields').getByRole('link', { name: 'geometry', exact: true }).click();
	await expect(page).toHaveURL(/types\/#spatial-element-data-geometry$/);
	const field = page.locator('#spatial-element-data-geometry');
	await expect(field).toContainText('Required');
	await field.getByRole('link', { name: 'SpatialElementGeometry', exact: true }).click();
	await expect(page).toHaveURL(/types\/#spatial-element-geometry$/);
	await expect(page.locator('#spatial-element-geometry-low')).toContainText('Lightweight GLB');
	await page.locator('#spatial-element-geometry-low').scrollIntoViewIfNeeded();
	await page.screenshot({ path: info.outputPath('nested-type-reference.png') });
	await page.keyboard.press('Control+k');
	const search = page.getByRole('combobox', { name: 'Search documentation' });
	await search.fill('SpatialElementMediaItem');
	await page.getByRole('option').first().click();
	await expect(page).toHaveURL(/types\/#spatial-element-media-item$/);
	await expect(page.locator('#spatial-element-media-item-captions-src')).toContainText('string');
});

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
	test(`CardGrid documentation changes real cards and matching source (enhanced: ${enhanced})`, async ({ page }, info) => {
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/docs/sections/card-grid/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
		await page.locator('.ps-content-menu-slot').getByRole('link', { name: 'Try it yourself', exact: true }).filter({ visible: true }).click();
		await expect(page.getByRole('combobox', { name: 'Card size', exact: true })).toBeInViewport();
		await page.getByRole('combobox', { name: 'Card size', exact: true }).selectOption('l');
		await reveal(page, page.getByLabel('Resting shadow'));
		await page.getByLabel('Resting shadow').check();
		await page.getByRole('combobox', { name: 'Media aspect', exact: true }).selectOption('3/2');
		await expect(page.locator('#live-grid [data-catalog-card]')).toHaveCount(4);
		await expect(page.locator('#live-grid [data-card-size]').first()).toHaveAttribute('data-card-size', 'l');
		await expect(page.locator('#example-code pre')).toContainText('cardSize="l"');
		await expect(page.locator('#example-code pre')).toContainText('cardShadow={true}');
		await expect(page.locator('#live-grid')).toContainText('A slender form');
		await page.getByLabel('Descriptions', { exact: true }).uncheck();
		await expect(page.locator('#live-grid')).not.toContainText('A slender form');
		const detailLink = page.locator('#live-grid').getByRole('link', { name: 'Column', exact: true });
		await reveal(page, detailLink);
		await page.screenshot({ path: info.outputPath('card-grid-live.png') });
		await detailLink.click();
		await expect(page).toHaveURL(/\/docs\/examples\/elements\/column\/$/);
		await expect(page.getByRole('heading', { name: 'Column', exact: true }).filter({ visible: true })).toBeVisible();
		expect(errors).toEqual([]);
	});
	test(`Carousel documentation supports initial selection and real interaction (enhanced: ${enhanced})`, async ({ page }, info) => {
		if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.goto('/docs/sections/carousel/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
		await page.locator('.ps-content-menu-slot').getByRole('link', { name: 'Try it yourself', exact: true }).filter({ visible: true }).click();
		await expect(page.getByRole('combobox', { name: 'Start with', exact: true })).toBeInViewport();
		await page.getByRole('combobox', { name: 'Start with', exact: true }).selectOption('ring');
		await expect(page.locator('#example-code pre')).toContainText('initialItemKey="ring"');
		const controls = page.getByRole('group', { name: 'Live carousel: element selection', exact: true });
		const option = enhanced ? controls.getByRole('button').nth(1) : controls.getByRole('link').nth(1);
		await reveal(page, option);
		await option.click();
		await expect(page.locator('#try-it-yourself [aria-live]')).toContainText('Selected: orb');
		await expect(option).toHaveAttribute(enhanced ? 'aria-pressed' : 'aria-current', 'true');
		await page.screenshot({ path: info.outputPath('carousel-live.png') });
	});
}

test('old chapter bookmarks redirect to the reorganized detail guides', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	for (const [before, after] of [['sections/detail-page', 'detail-pages'], ['sections/summaries', 'detail-pages/summaries'], ['interaction/media', 'detail-pages/media']]) {
		await page.goto('/docs/' + before + '/');
		await expect(page).toHaveURL(new RegExp('/docs/' + after + '/$'));
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	}
});
