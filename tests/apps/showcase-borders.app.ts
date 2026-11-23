import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
  test(`semantic edges remain configurable with enhanced=${enhanced}`, async ({ page }) => {
    if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.goto('/showcase/consumer/logitech-brio-500/');
    await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
    await page.addStyleTag({ content: '.ps-shell { --website-border: rgb(200, 50, 30) !important; --website-panel-border: rgb(30, 60, 200) !important; }' });
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
    await page.setViewportSize({ width: 2456, height: 1000 });
    await expect(panelEdge).toHaveCSS('border-top-width', '0px');
    await expect(panelEdge).toHaveCSS('border-bottom-width', '0px');
    await expect(panelEdge).toHaveCSS('border-left-width', '1px');
    await expect(panelEdge).toHaveCSS('border-right-width', '1px');
    await expect(panelEdge).toHaveCSS('border-radius', '0px');
    await page.setViewportSize({ width: 600, height: 900 });
    await page.evaluate(() => scrollTo(0, 0));
    const search = page.getByRole('button', { name: 'Open search', exact: true });
    await expect(search).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(search).toHaveCSS('border-top-width', '0px');
    await search.click();
    await expect(search).toHaveAttribute('data-active', 'true');
    await expect(search).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await search.click();
    await expect(search).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  });
}
