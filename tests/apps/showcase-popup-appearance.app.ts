import { expect, test } from '@playwright/test';

for (const width of [390, 1000, 1920]) {
  test('uniform popup surfaces and borderless header controls at ' + width, async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/docs/');
    await expect(page.locator('.mobile-search')).toBeAttached();
    const header = page.locator('.website-header .header');
    const headerBox = (await header.boundingBox())!;
    let appearance: unknown;
    async function surface(selector: string, anchorBottom = headerBox.y + headerBox.height, headerPopup = true) {
      const popup = page.locator(selector + ':popover-open');
      await expect(popup).toBeVisible();
      const box = (await popup.boundingBox())!;
      expect(Math.abs(box.y - anchorBottom - (headerPopup ? 0 : 8))).toBeLessThan(1);
      expect(box.x).toBeGreaterThanOrEqual(12);
      expect(box.x + box.width).toBeLessThanOrEqual(width - 12);
      const css = await popup.evaluate(el => {
        const s = getComputedStyle(el);
        return { border: s.borderTopWidth, radius: s.borderRadius, color: s.borderColor, background: s.backgroundColor, shadow: s.boxShadow };
      });
      expect(css.border).toBe(headerPopup ? '0px' : '1px');
      expect(css.radius).toBe('12px');
      if (appearance) expect({ ...css, border: undefined }).toEqual({ ...appearance as object, border: undefined });
      else appearance = css;
      return popup;
    }
    for (const control of await header.locator('.mobile-menu > summary, .settings > summary, .github-link, .mobile-search').filter({ visible: true }).all()) {
      await expect(control).toHaveCSS('outline-style', 'none');
      await expect(control).toHaveCSS('border-top-width', '0px');
    }
    if (width < 1200) {
      await header.locator('.mobile-menu > summary').click();
      const popup = await surface('.mobile-panel');
      const box = (await popup.boundingBox())!;
      expect(box.x).toBe(headerBox.x + 12);
      expect(box.width).toBe(headerBox.width - 24);
      await page.keyboard.press('Escape');
    } else {
      await header.locator('.desktop-menu').getByRole('link', { name: 'Documentation', exact: true }).hover();
      await surface('.ps-submenu');
      await page.mouse.move(5, 800);
      await expect(page.locator('.ps-submenu:popover-open')).toHaveCount(0);
    }
    if (width < 1600) {
      await header.locator('.settings > summary').click();
      await surface('.settings-panel');
      await page.keyboard.press('Escape');
    }
    if (width < 800) await header.getByRole('button', { name: 'Open search', exact: true }).click();
    else await header.getByRole('combobox').click();
    await surface(width < 800 ? '.search-surface' : '.search-panel');
    await page.keyboard.press('Escape');
    if (width < 1600) {
      const trigger = page.locator('.ps-content-menu-slot summary');
      const box = (await trigger.boundingBox())!;
      await trigger.click();
      const popup = await surface('.ps-content-menu-slot .popup', box.y + box.height, false);
      await expect(popup.getByRole('button', { name: 'Close content menu' })).toHaveCount(0);
      await trigger.click();
      await expect(popup).toBeHidden();
    }
  });
}
