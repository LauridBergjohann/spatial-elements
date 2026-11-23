import { expect, test } from '@playwright/test';
import type {} from '@spatial-elements/core/stage/stageVisualTest';

for (const width of [390, 600, 2456]) {
  test(`summary text selects and free space drags at ${width}px`, async ({ page }, info) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /WebGPU|Validation|Shader|WGSL/.test(message.text())) errors.push(message.text());
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/showcase/workbench/?stage-test=1');
    await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'enhanced', { timeout: 60000 });
    const carousel = page.locator('[data-carousel-section]').first();
    const selected = carousel.locator('.carousel-spatial-element.selected');
    await expect(selected).toHaveAttribute('data-catalog-model-ready', '');
    const initial = await selected.getAttribute('data-carousel-item');
    const compact = width < 840;
    const link = selected.locator(compact ? '.compact-copy' : '.panel-copy');
    const title = link.locator(compact ? 'h3' : '.summary-title');
    await link.scrollIntoViewIfNeeded();
    await title.hover();
    await expect(title).toHaveCSS('text-decoration-line', 'none');
    if (compact) await expect(link.locator('.compact-arrow')).toBeVisible();
    const text = await title.evaluate(node => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getClientRects()[0];
      return { x: rect.x + 2, y: rect.y + rect.height / 2 };
    });
    await page.mouse.move(text.x, text.y);
    await page.mouse.down();
    await page.mouse.move(text.x + 65, text.y, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => page.evaluate(() => getSelection()?.toString().length ?? 0)).toBeGreaterThan(0);
    await expect(selected).toHaveAttribute('data-carousel-item', initial!);
    await expect(page).toHaveURL(/\/showcase\/workbench\/\?stage-test=1$/);
    await page.evaluate(() => getSelection()?.removeAllRanges());
    await page.screenshot({ path: info.outputPath('carousel.png') });

    // The padding belongs to the link too; dragging it must not navigate.
    const panel = (await link.boundingBox())!;
    const x = panel.x + panel.width / 2, y = panel.y + 3;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 160, y, { steps: 12 });
    await page.mouse.up();
    await expect(selected).not.toHaveAttribute('data-carousel-item', initial!);
    await expect(page).toHaveURL(/\/showcase\/workbench\/\?stage-test=1$/);
    // Distant silhouettes fade after rendering; their materials retain depth writes.
    const actors = await page.evaluate(() => window.__stageVisualTest!.getCarouselStats()!.actors);
    const fading = actors.filter(actor => actor.opacity > 0 && actor.opacity < 1);
    if (compact) expect(fading.length).toBeGreaterThan(0);
    expect(fading.every(actor => actor.materialOpacity === 1 && actor.depthWrite)).toBe(true);
    await expect.poll(() => selected.locator('.summary').evaluate(node =>
      Number((node as HTMLElement).style.getPropertyValue('--carousel-panel-opacity'))
    )).toBeCloseTo(1, 3);
    const destination = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new URL(destination!, page.url()).href);
    expect(errors).toEqual([]);
  });
}
