import { expect, test, type Page } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function openFullscreenHero(page: Page, native: boolean) {
	if (!native) await page.addInitScript(() => {
		Object.defineProperty(Element.prototype, 'requestFullscreen', {
			configurable: true, value: () => Promise.reject(new Error('Fullscreen denied by fixture'))
		});
	});
	await page.goto('/demo/categories/carousel?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const source = page.locator('[data-carousel-item="column"] .spatial-element-target');
	await expect(page.locator('[data-catalog-model-ready]').first()).toBeAttached();
	await source.click();
	await expect(page).toHaveURL(/\/demo\/elements\/column$/);
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	await expect.poll(() => page.evaluate(() => Boolean(window.__stageVisualTest?.getDetailProjection('hero')))).toBe(true);
	await page.getByRole('button', { name: 'Fullscreen', exact: true }).click();
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-fullscreen', '');
	await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(native);
	await page.mouse.move(1435, 990);
	await page.evaluate(() => window.__stageVisualTest!.settle(60));
	const fitted = await page.evaluate(() => window.__stageVisualTest!.getDetailProjection('hero')!);
	await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.45, azimuth: 35, polar: 20 }, 60));
	const rotated = await page.evaluate(() => window.__stageVisualTest!.getDetailProjection('hero')!);
	expect(Math.max(...rotated.map((value, index) => Math.abs(value - fitted[index])))).toBeGreaterThan(0.001);
}

async function expectUsableCarousel(page: Page) {
	await expect(page).toHaveURL(/\/demo\/categories\/carousel\?stage-test=1$/);
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-stage-fullscreen', '');
	await expect(page.locator('[data-catalog-transition-actors], [data-catalog-staged-hold]')).toHaveCount(0);
	await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getSpatialCapture())).toBeNull();
	await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
	const selected = page.locator('[data-carousel-item="column"]');
	await expect(selected).toHaveClass(/selected/);
	const link = selected.locator('.spatial-element-target');
	await expect(link).toBeVisible();
	expect(await link.evaluate(node => Boolean(node.closest('[inert]')))).toBe(false);
	expect(await page.evaluate(() => [document.documentElement, document.body].some(node => node.style.overflow === 'hidden'))).toBe(false);
	// Exercise a real destination link after cleanup, not only its bounding box.
	await link.click();
	await expect(page).toHaveURL(/\/demo\/elements\/column$/);
	await expect(page.locator('[data-navigation-feedback]')).toHaveCount(0);
	await expect(page.locator('.stage')).not.toHaveAttribute('data-catalog-transition', /.+/);
	await expect.poll(() => page.evaluate(() => Boolean(window.__stageVisualTest!.getDetailProjection('hero')))).toBe(true);
}

test('Back captures the visible fallback-fullscreen pose before restoring inline layout', async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.stack ?? error.message));
	await openFullscreenHero(page, false);
	const source = await page.evaluate(() => {
		const api = window.__stageVisualTest!;
		api.holdNextPageBinding();
		return { projection: api.getDetailProjection('hero')!, width: innerWidth, height: innerHeight };
	});
	try {
		await page.goBack();
		await expect(page).toHaveURL(/\/demo\/categories\/carousel\?stage-test=1$/);
		await expect.poll(() => page.evaluate(() => window.__stageVisualTest!.getNavigationTimings().restoring)).toBeGreaterThan(0);
		const held = await page.evaluate(() => ({ capture: window.__stageVisualTest!.getSpatialCapture(),
			timings: window.__stageVisualTest!.getNavigationTimings(), width: innerWidth, height: innerHeight }));
		expect(held.timings.bound).toBe(0);
		expect(held.capture).not.toBeNull();
		expect(held.capture!.progress).toBe(0);
		expect([held.width, held.height]).toEqual([source.width, source.height]);
		const project = (matrix: number[], [x, y, z]: number[]) => {
			const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
			return [(1 + (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / w) * source.width / 2,
				(1 - (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / w) * source.height / 2];
		};
		const points = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]].map(point => {
			const before = project(source.projection, point), after = project(held.capture!.projection, point);
			return { point, before, after, error: Math.hypot(before[0] - after[0], before[1] - after[1]) };
		});
		await info.attach('fullscreen-source-projection', { body: JSON.stringify({ source, held, points }, null, 2), contentType: 'application/json' });
		for (const point of points) expect(point.error, JSON.stringify(points)).toBeLessThanOrEqual(1);
		await expect(page.locator('.stage')).not.toHaveAttribute('data-stage-fullscreen', '');
	} finally {
		await page.evaluate(() => window.__stageVisualTest?.releasePageBinding());
	}
	await expectUsableCarousel(page);
	expect(errors).toEqual([]);
});

test('Back exits native fullscreen and a subsequent resize leaves a usable destination', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.stack ?? error.message));
	await openFullscreenHero(page, true);
	await page.evaluate(() => window.__stageVisualTest!.holdNextPageBinding());
	try {
		await page.goBack();
		await expect(page).toHaveURL(/\/demo\/categories\/carousel\?stage-test=1$/);
		await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
		await page.setViewportSize({ width: 1280, height: 900 });
	} finally {
		await page.evaluate(() => window.__stageVisualTest?.releasePageBinding());
	}
	await expectUsableCarousel(page);
	expect(errors).toEqual([]);
});
