import { expect, test } from '@playwright/test';

for (const enhanced of process.env.SPATIAL_GPU ? [false, true] : [false]) {
  for (const width of [390, 600, 1700]) {
    test(`carousel summary links and controls at ${width}px, enhanced=${enhanced}`, async ({ page }, info) => {
      if (!enhanced) await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/showcase/consumer/');
      await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', enhanced ? 'enhanced' : 'fallback', { timeout: 60000 });
      const carousel = page.locator('[data-carousel-section]').first();
      const selected = carousel.locator('.carousel-spatial-element.selected');
      const summary = selected.locator('.summary');
      const compact = width < 840;
      const link = selected.locator(compact ? '.compact-copy' : '.panel-copy');
      await expect(link).toBeVisible();
      const destination = await link.getAttribute('href');
      expect(destination).toMatch(/\/showcase\/consumer\/.+/);
      if (compact) {
        await expect(summary).toHaveCSS('height', '66px');
        const panel = (await summary.boundingBox())!;
        const fit = (await selected.locator('[data-carousel-fit-anchor]').boundingBox())!;
        const dots = (await carousel.locator('.controls').boundingBox())!;
        expect(panel.y).toBeGreaterThan(fit.y + fit.height / 2);
        expect(panel.y + panel.height).toBeLessThanOrEqual(dots.y + 1);
        if (enhanced) {
          const next = carousel.getByRole('button', { name: 'Next product' });
          const arrow = (await next.boundingBox())!;
          expect(Math.abs(arrow.y + arrow.height / 2 - panel.y - panel.height / 2)).toBeLessThan(1);
          expect(arrow.x).toBeGreaterThanOrEqual(panel.x + panel.width);
          await expect(next).toHaveCSS('outline-style', 'none');
          await next.click();
          await expect.poll(async () => (await summary.boundingBox())!.y).toBeCloseTo(panel.y, 0);
          await expect(summary).toHaveCSS('height', '66px');
        }
      } else {
        await selected.getByRole('spinbutton', { name: 'Quantity' }).fill('3');
        const border = await page.locator('.search-field').evaluate(el => getComputedStyle(el).borderTopColor);
        await expect(selected.getByRole('spinbutton', { name: 'Quantity' })).toHaveCSS('border-top-color', border);
      }
      await page.screenshot({ path: info.outputPath('carousel.png') });
      const target = await link.getAttribute('href');
      const live = await selected.locator('.summary-presentation').elementHandle();
      await link.click();
      await expect(page).toHaveURL(new RegExp(target!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/?$'));
      await expect(page.locator('.summary-presentation .panel-copy').filter({ visible: true })).toHaveAttribute('href', target!.replace(/\/$/, '') + '/');
      if (enhanced && !compact) {
        await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
        expect(await live!.evaluate(el => el.isConnected)).toBe(true);
        await expect(page.locator('.summary-presentation').filter({ visible: true }).getByRole('spinbutton', { name: 'Quantity' })).toHaveValue('3');
      }
      if (enhanced) {
        await page.goBack();
        await expect(page.locator('[data-catalog-transition]')).toHaveCount(0, { timeout: 30000 });
        await expect(link).toBeFocused();
      }
    });
  }
}

test('text links underline on hover while header links stay plain', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto('/docs/');
  const link = page.locator('.prose a').first();
  await expect(link).toHaveCSS('text-decoration-line', 'none');
  await link.hover();
  await expect(link).toHaveCSS('text-decoration-line', 'underline');
  const headerLink = page.locator('.desktop-menu').getByRole('link', { name: 'Documentation', exact: true });
  await headerLink.hover();
  await expect(headerLink).toHaveCSS('text-decoration-line', 'none');
});
