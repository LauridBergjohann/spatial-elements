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
