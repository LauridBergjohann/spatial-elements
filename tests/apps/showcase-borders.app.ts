import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
  test(`semantic edges remain configurable with enhanced=${enhanced}`, async ({ page }) => {
    if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.goto('/showcase/consumer/logitech-brio-500/');
    await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
    await page.addStyleTag({ content: '.brand-stage-shell { --ps-border: rgb(200, 50, 30) !important; --ps-panel-border: rgb(30, 60, 200) !important; }' });
    await expect(page.locator('.satellite .appearance .ps-button-group').filter({ visible: true })).toHaveCSS('outline-color', 'rgb(200, 50, 30)');
    const dockEdge = await page.locator('.spatial-element-sticky-header').evaluate(el => {
      const css = getComputedStyle(el, '::before');
      return [css.borderTopWidth, css.borderBottomWidth, css.borderBottomColor];
    });
    expect(dockEdge).toEqual(['0px', '1px', 'rgb(30, 60, 200)']);
    const panelEdge = page.locator('.spatial-element-content > .panel-edge');
    await expect(panelEdge).toHaveCSS('border-top-color', 'rgb(30, 60, 200)');
    await expect(panelEdge).toBeVisible();
    await expect(page.locator('.spatial-icon-button').first()).toHaveCSS('outline-color', 'rgb(200, 50, 30)');
    await expect(page.locator('.button-group').first()).toHaveCSS('outline-color', 'rgb(200, 50, 30)');
    await expect(page.locator('.thumbnail-panel-content > .panel-edge').nth(1)).toHaveCSS('border-top-color', 'rgb(200, 50, 30)');
    const before = await panelEdge.boundingBox();
    await page.addStyleTag({ content: '.brand-stage-shell { --ps-panel-border: transparent !important; }' });
    await expect(panelEdge).toHaveCSS('border-top-color', 'rgba(0, 0, 0, 0)');
    const after = await panelEdge.boundingBox();
    expect(Math.abs(after!.width - before!.width)).toBeLessThan(1);
    expect(Math.abs(after!.height - before!.height)).toBeLessThan(1);
  });
}
