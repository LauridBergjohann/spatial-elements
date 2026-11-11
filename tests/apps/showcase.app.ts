import { expect, test } from '@playwright/test';

test('home explains the library and docs use the shared navigation', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('dimension');
	await expect(page.locator('#features .ps-card')).toHaveCount(6);
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
	test('showcase models enhance and nested collection navigation survives history', async ({
		page
	}, info) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto('/showcase/categories/list/?stage-test=1');
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
		await page.screenshot({ path: info.outputPath('wera-grid.png') });
		await page.locator('a[data-catalog-card]').first().click();
		await expect(page).toHaveURL(/\/showcase\/elements\//);
		await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
		await expect(page.locator('#demo-notice')).toContainText('cannot purchase');
		await page.goBack();
		await expect(page).toHaveURL(/\/showcase\/categories\/list/);
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
		await expect(page.locator('[data-catalog-card]')).toHaveCount(9);
		await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached({
			timeout: 60000
		});
		expect(errors).toEqual([]);
	});

test('all Wera tools are reachable and clearly identified as demonstrations', async ({ page }) => {
	await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
	await page.goto('/showcase/');
	await expect(page.locator('[data-catalog-card]')).toHaveCount(9);
	for (const id of [
		'tool-check-plus',
		'joker',
		'kraftform-xxl',
		'ph-kreuzschlitz',
		'kraftform-kompakt',
		'kraftform-kompakt-20',
		'winkelschluessel',
		'zyklop-speed'
	]) {
		const response = await page.goto('/showcase/elements/' + id + '/');
		expect(response?.status()).toBe(200);
		await expect(page.locator('#demo-notice')).toContainText('cannot purchase');
		await expect(page.locator('#demo-notice a')).toHaveAttribute('href', 'https://www.wera.de/');
		await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
	}
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
				'/showcase/elements/joker/'
			]) {
				const response = await page.goto(route);
				expect(response?.status()).toBe(200);
				await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
					true
				);
			}
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
