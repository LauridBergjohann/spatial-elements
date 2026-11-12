import { expect, test, type Page } from '@playwright/test';

async function observe(page: Page) {
	await page.evaluate(() => {
		const state = { frames: [] as { phase: string; recipe?: string; direction?: string }[] };
		Object.assign(window, { registeredTransitionObservation: state });
		const sample = () => {
			const root = document.querySelector<HTMLElement>('.stage');
			if (root?.dataset.catalogTransition)
				state.frames.push({
					phase: root.dataset.catalogTransition,
					recipe: root.dataset.catalogRecipe,
					direction: root.dataset.catalogDirection
				});
			requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	});
}
async function frames(page: Page) {
	return page.evaluate(
		() =>
			(
				window as unknown as {
					registeredTransitionObservation: {
						frames: { phase: string; recipe?: string; direction?: string }[];
					};
				}
			).registeredTransitionObservation.frames
	);
}
async function clear(page: Page) {
	await page.evaluate(
		() =>
			((
				window as unknown as { registeredTransitionObservation: { frames: unknown[] } }
			).registeredTransitionObservation.frames.length = 0)
	);
}
async function enhanced(page: Page) {
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
}
async function animated(page: Page, recipe: string) {
	try {
		await expect
			.poll(
				async () =>
					(await frames(page)).filter(
						(frame) => frame.phase === 'animating' && frame.recipe === recipe
					).length
			)
			.toBeGreaterThan(2);
	} catch (error) {
		console.log(
			await page.evaluate(() => ({
				decision: document.querySelector<HTMLElement>('.stage')?.dataset.catalogTransitionDecision,
				presentation: window.__stageVisualTest?.getCatalogPresentation(),
				timings: window.__stageVisualTest?.getNavigationTimings()
			}))
		);
		throw error;
	}
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	await expect(page.locator('[data-catalog-transition-actors]')).toHaveCount(0);
}

test('authored card links animate into arbitrary detail routes and back through history', async ({
	page
}) => {
	await page.goto('/curated?stage-test=1');
	await enhanced(page);
	await observe(page);
	await page.locator('[data-catalog-card][data-spatial-element-id="column"]').click();
	await expect(page).toHaveURL(/\/story\/column$/);
	await animated(page, 'list-to-hero');
	await clear(page);
	await page.goBack();
	await expect(page).toHaveURL(/\/curated\?stage-test=1$/);
	await animated(page, 'hero-to-list');
});

test('outgoing snapshots omit hidden menus and preserve relative images after a route change', async ({ page }) => {
	const failedImages: string[] = [];
	page.on('response', response => {
		if (response.status() >= 400 && response.url().includes('column.svg')) failedImages.push(response.url());
	});
	await page.goto('/curated?stage-test=1');
	await enhanced(page);
	await observe(page);
	await page.evaluate(async () => {
		const shell = document.createElement('div');
		shell.dataset.catalogShell = '';
		shell.style.cssText = 'position:fixed;top:8px;left:8px;width:40px;height:40px;pointer-events:none;';
		const picture = document.createElement('picture');
		const candidate = document.createElement('source');
		candidate.srcset = 'assets/demo/column.svg';
		const image = document.createElement('img');
		image.src = 'assets/demo/column.svg';
		image.alt = 'Retained navigation image';
		image.width = image.height = 40;
		picture.append(candidate, image);
		const hidden = document.createElement('nav');
		hidden.className = 'hidden-snapshot-menu';
		hidden.style.display = 'none';
		for (let index = 0; index < 100; index++) hidden.append(document.createElement('span'));
		shell.append(picture, hidden);
		document.querySelector('.stage')!.append(shell);
		await image.decode();
		const samples: { src: string; hiddenChildren: number }[] = [];
		Object.assign(window, { snapshotSamples: samples });
		new MutationObserver(() => {
			for (const copy of document.querySelectorAll('[data-catalog-shell-copy]')) {
				const img = copy.querySelector<HTMLImageElement>('img[alt="Retained navigation image"]');
				if (img) samples.push({ src: img.currentSrc || img.src,
					hiddenChildren: copy.querySelector('.hidden-snapshot-menu')!.childElementCount });
			}
		}).observe(document.body, { childList: true, subtree: true });
	});
	await page.locator('[data-catalog-card][data-spatial-element-id="column"]').click();
	await expect(page).toHaveURL(/\/story\/column$/);
	await animated(page, 'list-to-hero');
	const samples = await page.evaluate(() => (window as unknown as {
		snapshotSamples: { src: string; hiddenChildren: number }[]
	}).snapshotSamples);
	expect(samples.length).toBeGreaterThan(0);
	expect(samples.every(sample => sample.src.endsWith('/assets/demo/column.svg') && sample.hiddenChildren === 0)).toBe(true);
	expect(failedImages).toEqual([]);
});

for (const [source, target, recipe] of [
	['curated', 'gallery', 'list-to-list'],
	['curated', 'exhibition', 'list-to-carousel'],
	['exhibition', 'curated', 'carousel-to-list'],
	['exhibition', 'rotation', 'carousel-to-carousel']
])
	test(`${recipe} matches registered elements on a first visit to an arbitrary content route`, async ({
		page
	}) => {
		await page.goto(`/${source}?stage-test=1`);
		await enhanced(page);
		await observe(page);
		await page
			.getByRole('navigation', { name: 'Composition routes' })
			.locator(`a[href="/${target}"]`)
			.click();
		await expect(page).toHaveURL(new RegExp(`/${target}$`));
		await animated(page, recipe);
	});

test('an unrelated destination releases speculative captures and stays usable', async ({
	page
}) => {
	await page.goto('/curated?stage-test=1');
	await enhanced(page);
	await observe(page);
	await page.getByRole('link', { name: 'Ordinary page', exact: true }).click();
	await expect(page).toHaveURL(/\/reading$/);
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	expect((await frames(page)).some((frame) => frame.phase === 'animating')).toBe(false);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('[data-catalog-transition-actors]')).toHaveCount(0);
});

test('reduced motion retains native navigation without animating shared elements', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/curated?stage-test=1');
	await enhanced(page);
	await observe(page);
	await page.locator('[data-catalog-card][data-spatial-element-id="column"]').click();
	await expect(page).toHaveURL(/\/story\/column$/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	expect((await frames(page)).some((frame) => frame.phase === 'animating')).toBe(false);
});
