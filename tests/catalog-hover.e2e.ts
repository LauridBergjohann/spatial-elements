import { expect, test, type Locator } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

async function exposedPoint(target: Locator) {
	return target.evaluate(element => {
		const box = element.getBoundingClientRect();
		for (const fy of [0.5, 0.25, 0.75]) {
			const y = box.top + box.height * fy;
			for (let x = Math.min(innerWidth - 10, box.right - 5); x > Math.max(10, box.left); x -= 10) {
				if (y > 50 && y < innerHeight - 50 && element.contains(document.elementFromPoint(x, y))) return { x, y };
			}
		}
		throw new Error('Model target has no exposed point');
	});
}

for (const surface of ['frosted', 'glass']) test(`carousel ${surface}: model hover glows, reveals its identity and focus, and selected geometry opens detail`, async ({ page }, info) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('console', message => {
		if (message.type() === 'error' && /WebGPU|Validation|Shader|WGSL/.test(message.text())) errors.push(message.text());
	});
	await page.goto('/demo/categories/carousel?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	if (surface === 'glass') await page.locator('[data-carousel-spatial-element]').evaluateAll(nodes => {
		for (const node of nodes) (node as HTMLElement).dataset.carouselSurface = 'glass';
	});
	const items = page.locator('[data-carousel-section]').first().locator('[data-carousel-item]');
	// Use the exposed left neighbour; the right-hand seat can sit behind the summary.
	const controls = page.locator('[data-carousel-section]').first().locator('.controls');
	await controls.evaluate(el => window.scrollTo(0, scrollY + el.getBoundingClientRect().bottom - innerHeight + 40));
	await controls.locator('button').nth(1).click();
	const selected = items.nth(1), neighbour = items.first();
	await expect(selected.locator('.summary')).toHaveCSS('filter', 'none');
	await expect(selected).toHaveAttribute('data-catalog-model-ready');
	await selected.locator('.spatial-element-target').scrollIntoViewIfNeeded();
	await page.evaluate(() => window.__stageVisualTest!.settle(40));
	const id = await selected.locator('[data-catalog-geometry]').getAttribute('data-spatial-element-id');
	let point = await exposedPoint(selected.locator('.spatial-element-target'));
	await page.mouse.move(point.x, point.y);
	await expect.poll(() => page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)?.hover, id)).toBe(1);
	const hovered = await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!);
	expect(hovered.outline).toMatchObject({ targets: 1, size: 512 });
	expect(hovered.outline.captures).toBeGreaterThan(0);
	await page.screenshot({ path: info.outputPath('selected-model-glow.png') });
	await page.waitForTimeout(300);
	expect((await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!)).outline).toEqual(hovered.outline);
	// Neighbours expose selection; the same DOM node becomes a native detail link afterwards.
	await expect(neighbour).toHaveAttribute('data-catalog-model-ready');
	const neighbourId = await neighbour.locator('[data-catalog-geometry]').getAttribute('data-spatial-element-id');
	const initialBlur = await page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)!.blur, neighbourId);
	expect(initialBlur).toBeGreaterThan(0);
	const identity = `${await neighbour.locator('.eyebrow').textContent()} — ${await neighbour.locator('h3').textContent()}`;
	await expect(neighbour.locator('.spatial-element-target')).toHaveAttribute('title', identity);
	await expect(neighbour.locator('.spatial-element-target')).toHaveAccessibleName(`Select ${identity}`);
	await page.evaluate(id => {
		const samples: number[] = [];
		Object.assign(window, { carouselHoverBlurSamples: samples });
		const sample = () => {
			samples.push(window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)!.blur);
			if (samples.length < 45) requestAnimationFrame(sample);
		};
		requestAnimationFrame(sample);
	}, neighbourId);
	point = await exposedPoint(neighbour.locator('.spatial-element-target'));
	await page.mouse.move(point.x, point.y);
	await expect.poll(() => page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)?.hover, neighbourId)).toBe(1);
	expect(await page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)!.blur, neighbourId)).toBe(0);
	expect(await page.evaluate(initial => (window as unknown as { carouselHoverBlurSamples: number[] }).carouselHoverBlurSamples.some(value => value > 0 && value < initial), initialBlur)).toBe(true);
	await expect(neighbour).not.toHaveClass(/selected/);
	await page.screenshot({ path: info.outputPath('neighbour-model-glow.png') });
	await page.mouse.move(1, 1);
	await expect.poll(() => page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)!.blur, neighbourId)).toBe(initialBlur);
	await page.mouse.move(point.x, point.y);
	await page.mouse.click(point.x, point.y);
	await expect(neighbour).toHaveClass(/selected/);
	await expect(page).toHaveURL(/categories\/carousel/);
	await expect(neighbour.locator('.summary')).toHaveCSS('filter', 'none');
	const target = neighbour.locator('.spatial-element-target');
	const href = await target.getAttribute('href');
	expect(href).toBe(await neighbour.locator('.information').first().getAttribute('href'));
	await expect(target).not.toHaveAttribute('role', 'button');
	point = await exposedPoint(target);
	await page.mouse.click(point.x, point.y);
	await expect(page).toHaveURL(new RegExp(`${href}(?:\\?|$)`));
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
	await page.goBack();
	await expect(page).toHaveURL(/categories\/carousel/);
	await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
	await expect(neighbour).toHaveClass(/selected/);
	await expect(target).toBeFocused();
	expect(errors).toEqual([]);
});

test('carousel keyboard selection becomes a keyboard-activatable detail link', async ({ page }) => {
	await page.goto('/demo/categories/carousel?stage-test=1');
	await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
	const item = page.locator('[data-carousel-item]').nth(1);
	const target = item.locator('.spatial-element-target');
	await expect(item).toHaveAttribute('data-catalog-model-ready');
	await target.focus();
	const id = await item.locator('[data-catalog-geometry]').getAttribute('data-spatial-element-id');
	await expect.poll(() => page.evaluate(id => window.__stageVisualTest!.getCarouselStats()!.actors.find(a => a.spatialElementId === id)!.blur, id)).toBe(0);
	await expect(item).not.toHaveClass(/selected/);
	await target.press('Space');
	await expect(item).toHaveClass(/selected/);
	await expect(item.locator('.summary')).toHaveCSS('filter', 'none');
	await expect(target).toBeFocused();
	await target.press('Enter');
	await expect(page).toHaveURL(/elements\//);
});
