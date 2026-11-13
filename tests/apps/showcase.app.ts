import { expect, test } from '@playwright/test';

import type { Locator } from '@playwright/test';
import { showcaseProducts } from '../../apps/website/src/lib/showcase/products';

test('home explains the library and docs use the shared navigation', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('dimension');
	await expect(page.locator('#features .ps-card')).toHaveCount(6);
	await expect(page.locator('#featured-products [data-carousel-spatial-element]')).toHaveCount(4);
	await expect(page.locator('main section[id]').first()).toHaveAttribute('id', 'featured-products');
	await expect(page.locator('.stage')).toHaveCount(1);
	await page.goto('/docs/foundations/assets/');
	await expect(page.getByRole('navigation', { name: 'Documentation chapters' })).toBeVisible();
	await expect(page.getByRole('navigation', { name: 'Breadcrumb', exact: true })).toContainText(
		'Foundations'
	);
	await expect(
		page.getByRole('navigation', { name: 'Reading order' }).locator('[rel=next]')
	).toBeVisible();
	await page.keyboard.press('Control+k');
	const search = page.getByRole('combobox', { name: 'Search documentation' });
	await expect(search).toBeFocused();
	await search.fill('spatial collection playground');
	await search.press('Enter');
	await expect(page).toHaveURL(/\/docs\/sections\/playground\/$/);
});

test('theme preference works and survives reload without fixing a palette in the test', async ({
	page
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Dark', exact: true }).filter({ visible: true }).click();
	await expect(page.locator('.ps-shell')).toHaveAttribute('data-ps-theme', 'dark');
	await page.reload();
	await expect(page.locator('.ps-shell')).toHaveAttribute('data-ps-theme', 'dark');
	await page.getByRole('button', { name: 'Light', exact: true }).filter({ visible: true }).click();
	await expect(page.locator('.ps-shell')).toHaveAttribute('data-ps-theme', 'light');
});

test('theme still changes when storage is blocked', async ({ page }) => {
	await page.addInitScript(() => {
		for (const method of ['getItem', 'setItem'])
			Object.defineProperty(Storage.prototype, method, {
				value: () => {
					throw Error('Blocked');
				}
			});
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Dark', exact: true }).filter({ visible: true }).click();
	await expect(page.locator('.ps-shell')).toHaveAttribute('data-ps-theme', 'dark');
});

test('one palette and frosted navigation follow the chosen mode across the website', async ({
	page
}) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/');
	for (const mode of ['Dark', 'Light']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		let palette: unknown;
		for (const route of [
			'/',
			'/docs/foundations/assets/',
			'/showcase/',
			'/showcase/elements/joker/',
			'/showcase/elements/chronograph/'
		]) {
			await page.goto(route);
			await expect(page.locator('.brand-stage-shell')).toHaveAttribute(
				'data-color-scheme',
				mode.toLowerCase()
			);
			const appearance = await page.locator('.ps-navigation .header').evaluate((element) => {
				const style = getComputedStyle(element);
				return {
					accent: style.getPropertyValue('--ps-accent').trim(),
					ink: style.getPropertyValue('--ps-ink').trim(),
					surface: style.backgroundColor
				};
			});
			palette ??= appearance;
			expect(appearance).toEqual(palette);
			for (const panel of ['.header', '.satellite.right']) {
				const surface = page.locator('.ps-navigation ' + panel);
				await expect(surface).toHaveCSS('backdrop-filter', 'blur(16px)');
				await expect(surface).not.toHaveCSS('box-shadow', 'none');
				await expect(surface).toHaveCSS('background-color', appearance.surface);
			}
		}
	}
});

test('playground updates preview and source together and can reset', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/docs/sections/playground/');
	await page.getByRole('combobox', { name: 'Card tone', exact: true }).selectOption('standard');
	await page.getByRole('combobox', { name: 'Media aspect', exact: true }).selectOption('1/1');
	await expect(page.locator('#collection-grid .ps-card').first()).toHaveAttribute(
		'data-tone',
		'standard'
	);
	await expect(page.locator('#source')).toContainText('cardTone="standard"');
	await expect(page.locator('#source')).toContainText('mediaAspect="1/1"');
	await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('carousel');
	await expect(page.locator('[data-carousel-section]')).toBeVisible();
	await expect(page.locator('#source')).toContainText('SpatialCarouselSection');
	await page.getByRole('button', { name: 'Reset example' }).click();
	await expect(page.locator('#source')).toContainText('cardTone="muted"');
	await expect(page.locator('#collection-grid .ps-card').first()).toHaveAttribute(
		'data-tone',
		'muted'
	);
	expect(errors).toEqual([]);
});

if (process.env.SPATIAL_GPU)
	test('showcase root animates into details and back through history', async ({ page }, info) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/showcase/?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', {
			timeout: 60000
		});
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached({
			timeout: 60000
		});
		await expect(page.locator('.ps-navigation .header')).toHaveAttribute(
			'data-stage-panel-bound',
			''
		);
		await expect(page.locator('.ps-navigation .satellite.right')).toHaveAttribute(
			'data-stage-panel-bound',
			''
		);
		const centerCard = async (card: Locator) => {
			const viewport = page.viewportSize()!;
			await page.mouse.move(viewport.width - 20, viewport.height / 2);
			const bounds = (await card.boundingBox())!;
			await page.mouse.wheel(0, bounds.y + bounds.height / 2 - viewport.height / 2);
			await expect(card).toBeInViewport({ ratio: 0.99 });
		};
		// The final products must receive real 3D models when scrolled into view,
		// even though the complete collection is larger than the active-model budget.
		for (const product of showcaseProducts.slice(-2)) {
			const card = page.locator(`[data-catalog-card][data-spatial-element-id="${product.id}"]`);
			await centerCard(card);
			await expect(card).toHaveAttribute('data-catalog-model-ready', '', { timeout: 60000 });
		}
		const transitionCard = page.locator('[data-catalog-card]').first();
		// The stage's virtual scrolling follows wheel input. Large cards extend
		// below the fold and must be fully visible for a shared transition.
		await centerCard(transitionCard);
		await expect(transitionCard).toHaveAttribute('data-catalog-model-ready', '', {
			timeout: 60000
		});
		await expect
			.poll(
				() =>
					page.evaluate(
						() =>
							window.__stageVisualTest
								?.getCarouselStats()
								?.actors.find((actor) => actor.spatialElementId === 'tool-check-plus')?.stagedReady
					),
				{ timeout: 60000 }
			)
			.toBe(true);
		await page.screenshot({ path: info.outputPath('wera-grid.png') });
		await page.evaluate(() => {
			const recipes: string[] = [];
			Object.assign(window, { showcaseTransitionRecipes: recipes });
			const sample = () => {
				const stage = document.querySelector<HTMLElement>('.stage');
				if (stage?.dataset.catalogTransition === 'animating')
					recipes.push(stage.dataset.catalogRecipe!);
				requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		const observedRecipes = () =>
			page.evaluate(
				() =>
					(window as unknown as { showcaseTransitionRecipes: string[] }).showcaseTransitionRecipes
			);
		await transitionCard.click();
		await expect(page).toHaveURL(/\/showcase\/elements\//);
		try {
			await expect.poll(observedRecipes).toContain('list-to-hero');
		} catch (error) {
			console.log(
				await page.evaluate(() => ({
					decision:
						document.querySelector<HTMLElement>('.stage')?.dataset.catalogTransitionDecision,
					endpoints: window.__stageVisualTest?.getCatalogEndpoints(),
					timings: window.__stageVisualTest?.getNavigationTimings()
				}))
			);
			throw error;
		}
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		await expect(page.locator('#demo-notice')).toContainText('cannot purchase');
		await page.goBack();
		await expect(page).toHaveURL(/\/showcase\/\?stage-test=1$/);
		await expect.poll(observedRecipes).toContain('hero-to-list');
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		await page.goto('/showcase/elements/chronograph/');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', {
			timeout: 60000
		});
		await expect(page.locator('canvas').first()).toBeVisible();
		await page.screenshot({ path: info.outputPath('watch-detail.png') });
		// The same shell also hosts documentation with a different collection namespace.
		await page.keyboard.press('Control+k');
		const search = page.getByRole('combobox', { name: 'Search documentation' });
		await search.fill('spatial collection playground');
		await search.press('Enter');
		await expect(page).toHaveURL(/\/docs\/sections\/playground\/$/);
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached({
			timeout: 60000
		});
		await page
			.locator('.desktop-menu')
			.getByRole('link', { name: 'Showcase', exact: true })
			.click();
		await expect(page).toHaveURL(/\/showcase\/$/);
		await expect(page.locator('[data-catalog-card]')).toHaveCount(showcaseProducts.length);
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached({
			timeout: 60000
		});
		expect(errors).toEqual([]);
	});

test('all products have a complete fallback image and identify the manufacturer', async ({
	page
}) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/showcase/');
	await expect(page.locator('[data-catalog-card]')).toHaveCount(showcaseProducts.length);
	for (const product of showcaseProducts) {
		const response = await page.goto('/showcase/elements/' + product.id + '/');
		expect(response?.status()).toBe(200);
		await expect(page.locator('#demo-notice')).toContainText('cannot purchase');
		await expect(page.locator(`#demo-notice a[href="${product.manufacturer.href}"]`)).toBeVisible();
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
		const poster = page.locator('.stage-viewport-fallback-image');
		await expect(poster).toHaveAttribute(
			'src',
			`/assets/showcase/${product.id}/${product.id}-poster.webp`
		);
		await expect(poster).toHaveCSS('opacity', '1');
		await expect
			.poll(() =>
				poster.evaluate((image: HTMLImageElement) => ({
					complete: image.complete,
					width: image.naturalWidth,
					height: image.naturalHeight
				}))
			)
			.toEqual({ complete: true, width: 1024, height: 1024 });
	}
});

test('product media selects full photographs and loads YouTube only on request', async ({
	page
}, info) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	const playerRequests: string[] = [];
	await page.route('https://www.youtube-nocookie.com/**', async (route) => {
		playerRequests.push(route.request().url());
		await route.fulfill({ contentType: 'text/html', body: '<p>Local video player fixture</p>' });
	});
	const product = showcaseProducts.find((item) => item.id === 'logitech-brio-500')!;
	await page.goto(`/showcase/elements/${product.id}/`);
	const header = page.locator('[data-spatial-element-sticky-header]');
	const rail = page.locator('[data-spatial-element-media-rail]');
	await expect(header).toHaveAttribute('aria-hidden', 'true');
	await expect(page.locator('#photographs figure')).toHaveCount(product.photos.length);
	await expect(page.locator('iframe')).toHaveCount(0);
	expect(playerRequests).toEqual([]);
	const photo = product.photos[0];
	const photoButton = page.getByRole('button', { name: photo.label, exact: true });
	await expect(photoButton.locator('img')).toHaveAttribute('src', photo.small.src);
	await expect(photoButton.locator('img')).toHaveAttribute('loading', 'lazy');
	await photoButton.click();
	await expect(page.locator('[data-spatial-native-media="image"] img')).toHaveAttribute(
		'src',
		photo.src
	);
	await expect(photoButton).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: product.video!.label, exact: true }).click();
	await expect(page.locator('[data-spatial-native-media="youtube"] iframe')).toHaveAttribute(
		'src',
		`https://www.youtube-nocookie.com/embed/${product.video!.id}?autoplay=0&rel=0`
	);
	await expect.poll(() => playerRequests.length).toBe(1);
	// Scrolling a long thumbnail rail must not dock the page's detail header.
	await expect.poll(() => rail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
	await expect(header).toHaveAttribute('aria-hidden', 'true');
	await page.getByRole('button', { name: 'Interactive 3D view', exact: true }).click();
	await expect(page.locator('iframe')).toHaveCount(0);
	await page.screenshot({ path: info.outputPath('brio-fallback-overview.png') });
	await page
		.locator('[data-spatial-element-tab-id="photographs"]')
		.filter({ visible: true })
		.click();
	// Scrolling the page itself still docks the header normally.
	await expect(header).toHaveAttribute('aria-hidden', 'false');
	await expect
		.poll(() =>
			page
				.locator('#photographs img')
				.evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete))
		)
		.toBe(true);
	await page.screenshot({ path: info.outputPath('brio-photographs.png') });
});

test('watch credits its inspiration and links to the manufacturer', async ({ page }) => {
	await page.goto('/showcase/elements/chronograph/');
	await expect(page.locator('#demo-notice')).toContainText('cannot purchase');
	await expect(page.locator('#demo-notice a[href="https://www.rolex.com/"]')).toBeVisible();
	await expect(page.locator('#demo-notice a[href*="webgl_watch.html"]')).toBeVisible();
});

for (const width of [320, 840, 1920])
	test(`website stays usable without JavaScript at ${width}px`, async ({ browser, baseURL }) => {
		const context = await browser.newContext({
			baseURL,
			javaScriptEnabled: false,
			viewport: { width, height: 900 }
		});
		try {
			const page = await context.newPage();
			for (const route of [
				'/',
				'/getting-started/',
				'/docs/foundations/assets/',
				'/showcase/elements/joker/',
				'/showcase/elements/logitech-brio-500/'
			]) {
				const response = await page.goto(route);
				expect(response?.status()).toBe(200);
				await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
			const product = showcaseProducts.find((item) => item.id === 'logitech-brio-500')!;
			await expect(page.locator('#photographs figure')).toHaveCount(product.photos.length);
			await expect(page.locator('#video a')).toHaveAttribute('href', product.video!.href);
			await expect(page.locator('iframe')).toHaveCount(0);
			const photo = page.locator('#photographs figure img').first();
			await photo.scrollIntoViewIfNeeded();
			await expect
				.poll(() => photo.evaluate((image: HTMLImageElement) => image.naturalWidth))
				.toBeGreaterThan(0);
			await expect(page.locator('#photographs figure a').first()).toHaveAttribute(
				'href',
				product.photos[0].src
			);
			await page.goto('/');
			if (width < 1200) {
				await page.locator('.mobile-menu>summary').click();
				await expect(
					page.locator('.mobile-panel').getByRole('link', { name: 'Documentation', exact: true })
				).toBeVisible();
			}
		} finally {
			await context.close();
		}
	});

test('minimal demo remains a small usable collection without GPU', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	try {
		const page = await context.newPage();
		await page.goto('http://127.0.0.1:4173/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('My collection');
		await page.locator('a[data-catalog-card]').first().click();
		await expect(page).toHaveURL(/\/starter\/elements\/cube/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cube');
	} finally {
		await context.close();
	}
});

for (const width of [390, 1920]) {
	test(`media framing and overflow controls stay inside their viewport at ${width}px`, async ({ page }, info) => {
		await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/showcase/elements/logitech-m750/');
		const rail = page.locator('[data-spatial-element-media-rail]');
		await expect(rail).toHaveCSS('scrollbar-width', 'none');
		const next = page.getByRole('button', { name: 'Next media', exact: true });
		const previous = page.getByRole('button', { name: 'Previous media', exact: true });
		await expect(next).toBeVisible();
		const controlBounds = (await next.boundingBox())!;
		const railBounds = (await rail.boundingBox())!;
		expect(width >= 840 ? controlBounds.width : controlBounds.height).toBeCloseTo(
			width >= 840 ? railBounds.width : railBounds.height, 0
		);
		expect(width >= 840 ? controlBounds.height : controlBounds.width).toBeLessThanOrEqual(28);
		await expect(previous).toHaveCount(0);
		await next.click();
		await expect(previous).toBeVisible();
		const product = showcaseProducts.find(product => product.id === 'logitech-m750')!;
		for (const photo of [product.photos.at(-1)!, product.photos[0]]) {
			const button = page.getByRole('button', { name: photo.label, exact: true });
			await button.click();
			await expect(page.locator('.thumb[aria-pressed="true"]')).toHaveCount(1);
			await expect(button.locator('img')).toHaveCSS('object-fit', photo.fit);
			const image = page.locator('[data-spatial-native-media="image"] img');
			await expect(image).toHaveCSS('object-fit', photo.fit);
			const stage = await page.locator('.spatial-element-visual').boundingBox();
			const media = await image.boundingBox();
			expect(media!.x).toBeGreaterThanOrEqual(stage!.x - 1);
			expect(media!.y).toBeGreaterThanOrEqual(stage!.y - 1);
			expect(media!.y + media!.height).toBeLessThanOrEqual(stage!.y + stage!.height + 1);
			await expect(button).toHaveCSS('padding', '0px');
		}
		await page.screenshot({ path: info.outputPath('media-contain.png') });
		if (width >= 840) {
			const tabs = page.locator('[data-spatial-element-tab-list="panel"]');
			await expect(tabs).toContainText('Explore the details');
			// Exercise the real overflow behavior even on a page with short section labels.
			await tabs.evaluate(element => element.style.maxWidth = '220px');
			await tabs.getByRole('button', { name: 'Next sections', exact: true }).click();
			await expect(tabs.getByRole('button', { name: 'Previous sections', exact: true })).toBeVisible();
		}
	});
}

if (process.env.SPATIAL_GPU) test('enhanced media clips thumbnails and clears controls while zooming', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.setViewportSize({ width: 1920, height: 900 });
	await page.goto('/showcase/elements/logitech-m750/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	const product = showcaseProducts.find(product => product.id === 'logitech-m750')!;
	for (const mode of ['Light', 'Dark']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		const neutral = mode === 'Light' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)';
		await expect(page.locator('.ps-navigation .header').getByRole('link', { name: 'Showcase', exact: true })).toHaveCSS('color', neutral);
		await expect(page.locator('[data-spatial-element-tab-id="product"]').filter({ visible: true })).toHaveCSS('color', neutral);
		await page.getByRole('button', { name: product.photos[0].label, exact: true }).click();
		await expect(page.locator('.thumb[aria-pressed="true"]')).toHaveCount(1);
		await page.screenshot({ path: info.outputPath(`selected-photo-${mode}.png`) });
		await page.getByRole('button', { name: 'Interactive 3D view', exact: true }).click();
		await page.mouse.move(800, 440);
		await page.screenshot({ path: info.outputPath(`selected-model-${mode}.png`) });
	}
	await page.getByRole('button', { name: 'Next media', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Previous media', exact: true })).toBeVisible();
	const rail = page.locator('[data-spatial-element-media-rail]');
	expect(await rail.locator('.thumb-image').count()).toBe(product.photos.length);
	// Native thumbnails retain the clipping ancestor even after enhancement.
	expect(await rail.locator('[data-stage-panel-css-surface]').count()).toBe(product.photos.length);
	await page.screenshot({ path: info.outputPath('scrolled-media-rail.png') });
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.8 }));
	await expect(page.getByRole('button', { name: 'Previous media', exact: true })).toBeHidden();
	await expect(page.locator('.thumb-image').filter({ visible: true })).toHaveCount(0);
	await expect(page.locator('.thumb-minimap')).toBeInViewport();
	await page.screenshot({ path: info.outputPath('zoomed-media.png') });
	await page.evaluate(() => window.__stageVisualTest!.reset());
	await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	await expect(page.locator('[data-overflow-controls="media"]')).toBeHidden();
	await page.getByRole('button', { name: 'Detail view', exact: true }).click();
	await expect(page.locator('.stage')).not.toHaveAttribute('data-stage-fullscreen', '');
	expect(errors).toEqual([]);
});

if (process.env.SPATIAL_GPU) test('featured carousel renders the selected products in both themes', async ({ page }, info) => {
	await page.goto('/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
	const carousel = page.locator('#featured-products');
	await expect(carousel.locator('[data-carousel-spatial-element]')).toHaveCount(4);
	await expect(carousel.locator('[data-catalog-model-ready]').first()).toBeAttached({ timeout: 60000 });
	for (const mode of ['Light', 'Dark']) {
		await page.getByRole('button', { name: mode, exact: true }).filter({ visible: true }).click();
		const selected = carousel.locator('.carousel-spatial-element.selected .spatial-element-target');
		await expect(selected).toHaveAttribute('href', '/showcase/elements/kraftform-kompakt');
		await selected.hover();
		await page.screenshot({ path: info.outputPath(`featured-carousel-${mode}.png`) });
	}
});

if (process.env.SPATIAL_GPU) for (const source of ['grid', 'carousel']) {
	test(`${source} detail transition retains exclusive geometry, media interaction and submenu`, async ({ page }, info) => {
		await page.setViewportSize({ width: 1920, height: 1000 });
		await page.goto(source === 'grid' ? '/showcase/?stage-test=1' : '/?stage-test=1');
		await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
		const card = source === 'grid'
			? page.locator('[data-catalog-card][data-spatial-element-id="logitech-ergo-k860"]')
			: page.locator('#featured-products .carousel-spatial-element.selected');
		if (source === 'grid') {
			const bounds = (await card.boundingBox())!;
			await page.mouse.move(1900, 500);
			await page.mouse.wheel(0, bounds.y + bounds.height / 2 - 500);
			await expect(card).toBeInViewport({ ratio: 0.99 });
		}
		await expect(card).toHaveAttribute('data-catalog-model-ready', '', { timeout: 60000 });
		await page.evaluate(() => {
			const samples: { phase: string; posters: number[] }[] = [];
			Object.assign(window, { detailTransitionSamples: samples });
			const sample = () => {
				const phase = document.querySelector<HTMLElement>('.stage')?.dataset.catalogTransition;
				if (phase) samples.push({ phase, posters: [...document.querySelectorAll('.stage-viewport-fallback-image')]
					.map(image => Number(getComputedStyle(image).opacity)) });
				if (samples.length < 300) requestAnimationFrame(sample);
			};
			requestAnimationFrame(sample);
		});
		await (source === 'grid' ? card : card.locator('.spatial-element-target')).click();
		await expect(page).toHaveURL(/\/showcase\/elements\//);
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		const samples = await page.evaluate(() => (window as unknown as {
			detailTransitionSamples: { phase: string; posters: number[] }[]
		}).detailTransitionSamples);
		expect(samples.some(sample => sample.phase === 'animating')).toBe(true);
		expect(samples.some(sample => sample.posters.length > 0)).toBe(true);
		expect(samples.flatMap(sample => sample.posters).every(opacity => opacity === 0)).toBe(true);
		const tabs = page.locator('[data-spatial-element-tab-list="panel"]');
		await expect(tabs).toBeVisible();
		await expect(page.locator('[data-spatial-element-tabs-panel-anchor]')).toHaveAttribute('data-spatial-element-tabs-measured', '');
		const photo = page.locator('.thumb-image').first();
		await photo.click();
		await expect(photo).toHaveAttribute('aria-pressed', 'true');
		await page.getByRole('button', { name: 'Interactive 3D view', exact: true }).click();
		await expect(page.locator('.thumb-minimap')).toHaveAttribute('aria-pressed', 'true');
		await page.mouse.move(1000, 100);
		const resting = await page.evaluate(() => window.__stageVisualTest!.getMinimapModelRect()!.width);
		await page.locator('.thumb-minimap').hover();
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getMinimapModelRect()!.width)).toBeGreaterThan(resting * 1.02);
		await page.screenshot({ path: info.outputPath('detail-interactive.png') });
		await tabs.locator('[data-spatial-element-tab-id="product"]').click();
		await expect(page.locator('[data-spatial-element-sticky-header]')).toHaveAttribute('aria-hidden', 'false');
		await expect(page.locator('.media-indicator')).toHaveCSS('opacity', '0');
		await page.screenshot({ path: info.outputPath('detail-docked.png') });
	});
}

if (process.env.SPATIAL_GPU) test('Z407 has a measured submenu after a direct load', async ({ page }) => {
	await page.goto('/showcase/elements/logitech-z407/?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-page-ready', '', { timeout: 60000 });
	await expect(page.locator('[data-spatial-element-tabs-panel-anchor]')).toHaveAttribute('data-spatial-element-tabs-measured', '');
	await expect(page.locator('[data-spatial-element-tab-list="panel"]')).toContainText('Explore the details');
	await expect(page.locator('[data-spatial-element-tab-list="panel"]')).toBeVisible();
});
