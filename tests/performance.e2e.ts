import { test, expect } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

test.use({ viewport: { width: 1098, height: 831 }, deviceScaleFactor: 2 });

test('render budget remains bounded through navigation, scroll and close-up', async ({ page }, info) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.goto('/demo/categories/list?stage-test=1');
 await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced');
 const card = page.locator('[data-catalog-card][data-spatial-element-id="torus-knot"]');
 await card.scrollIntoViewIfNeeded();
 await expect(card).toHaveAttribute('data-catalog-model-ready', '');
 await card.click();
 await expect(page).toHaveURL(/elements\/torus-knot/);
 await expect(page.locator('[data-catalog-transition]')).toHaveCount(0);
 await expect.poll(() => page.evaluate(() => window.__stageVisualTest?.getCatalogPresentation()?.representations.state)).toBe('high');
 const initial = await page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats());
 expect(initial.warmups).toBeGreaterThanOrEqual(2);
 expect(initial.pixelRatio).toBe(1);
 for (const canvas of initial.canvases) expect(canvas.width * canvas.height).toBeLessThanOrEqual(1920 * 1080);
 await page.evaluate(() => window.__stageVisualTest!.setView({ zoom: 0.9, azimuth: 35, polar: 75 }));
 const focused = await page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats());
 expect(focused.creations).toBe(initial.creations);
 expect(focused.resizes).toBe(initial.resizes);
 await page.screenshot({ path: info.outputPath('close-up.png') });
 await page.evaluate(() => window.__stageVisualTest!.reset());
 await page.mouse.move(1080, 400);
 await page.mouse.wheel(0, 650);
 await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(100);
 await page.screenshot({ path: info.outputPath('scrolled.png') });
 const scrolled = await page.evaluate(() => window.__stageVisualTest!.getRenderTargetStats());
 expect(scrolled.creations).toBe(initial.creations);
 for (const canvas of scrolled.canvases) expect(canvas.width * canvas.height).toBeLessThanOrEqual(1920 * 1080);
 expect(errors).toEqual([]);
});
