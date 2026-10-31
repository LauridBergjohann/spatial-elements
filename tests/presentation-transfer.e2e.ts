import { expect, test } from '@playwright/test';

test('controlled carousel context updates stay outside the route updater reactive dependencies', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
 await page.goto('/proof/carousel-layout?custom=1&count=2');
 await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
 const input = page.getByLabel('Option for Column 1');
 const original = await input.elementHandle();
 await input.fill('Controlled context stays live');
 for (const width of [600, 1200, 839, 1440]) {
  await page.setViewportSize({ width, height: 900 });
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
 }
 await expect(input).toHaveValue('Controlled context stays live');
 expect(await original!.evaluate(node => node === document.querySelector('input'))).toBe(true);
 await page.locator('.controls a').nth(1).click();
 await page.locator('.controls a').first().click();
 await page.getByRole('button', { name: 'Add one Column 1' }).click();
 await expect(page.locator('[data-carousel-item="seat-0"] [data-carousel-custom-state]')).toHaveText('Controlled context stays live: 2');
 expect(errors).toEqual([]);
});

for (const route of ['summary', 'card']) {
 test(`cancel restores the ${route} root and its route cleanup lease`, async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
  await page.goto(`/proof/presentation-transfer/${route}`);
  await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
  const root = await page.locator('[data-spatial-presentation-root]').elementHandle();
  if (route === 'summary') await page.getByLabel('Retained note').fill('Cancelled and restored');
  await page.getByRole('button', { name: 'Hold source without routing' }).click();
  await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase', 'test-held');
  expect(await root!.evaluate(node => (node as HTMLElement).inert)).toBe(true);
  await page.getByRole('button', { name: 'Restore cancelled source' }).click();
  await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase', 'restored');
  expect(await root!.evaluate(node => node === document.querySelector('[data-transfer-source] [data-spatial-presentation-root]'))).toBe(true);
  expect(await root!.evaluate(node => (node as HTMLElement).inert)).toBe(false);
  if (route === 'summary') {
   await page.getByRole('button', { name: 'Add retained quantity' }).click();
   await expect(page.locator('[data-transfer-state]')).toHaveText('Cancelled and restored: 2');
  }
  await page.getByRole('link', { name: 'Leave owner' }).click();
  expect(await root!.evaluate(node => node.isConnected)).toBe(false);
  if (route === 'summary') await expect.poll(() => page.evaluate(() => (window as any).__presentationProof)).toEqual({ mounts: 1, destroys: 1 });
 });
}

test('a held card keeps the prepared GPU poster decision after catalog disposal clears its marker', async ({ page }) => {
 await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
 await page.goto('/proof/presentation-transfer/card');
 await expect(page.locator('.stage')).toHaveAttribute('data-stage-state', 'fallback');
 const card = page.locator('[data-catalog-card]');
 const poster = card.locator('.catalog-poster');
 await card.evaluate(node => node.setAttribute('data-catalog-model-ready', ''));
 await expect(poster).toHaveCSS('opacity', '0');
 await page.getByRole('button', { name: 'Hold source without routing' }).click();
 await card.evaluate(node => node.removeAttribute('data-catalog-model-ready'));
 await expect(page.locator('[data-spatial-presentation-root]')).toHaveAttribute('data-spatial-presentation-model-ready', '');
 await expect(poster).toHaveCSS('opacity', '0');
 await page.getByRole('button', { name: 'Restore cancelled source' }).click();
 await expect(page.locator('[data-spatial-presentation-root]')).not.toHaveAttribute('data-spatial-presentation-model-ready');
 await expect(poster).toHaveCSS('opacity', '1');
});

for (const route of ['summary', 'card', 'detail']) {
 test(`production ${route} presentation is present without JavaScript`, async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
   const page = await context.newPage();
   await page.goto(`/proof/presentation-transfer/${route}`);
   await expect(page.locator('[data-spatial-presentation-root]')).toHaveCount(1);
   if (route === 'card') {
    const card = page.locator('[data-catalog-card]');
    await expect(card).toHaveAccessibleName('Column');
    const box = await card.boundingBox();
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1);
   } else await expect(page.getByLabel('Retained note')).toBeVisible();
  } finally { await context.close(); }
 });
}

test('the production summary retains its real surface, input, local box and delegated events across route ownership', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => {
  Object.defineProperty(navigator, 'gpu', { value: undefined });
  const observer = new MutationObserver(() => {
   const node = document.querySelector('[data-live-transfer-summary]');
   if (node && !(window as any).__serverTransfer) { (window as any).__serverTransfer = node; observer.disconnect(); }
  });
  observer.observe(document, { childList: true, subtree: true });
 });
 await page.goto('/proof/presentation-transfer/summary');
 await expect.poll(() => page.evaluate(() => (window as any).__presentationProof?.mounts)).toBe(1);
 expect(await page.evaluate(() => (window as any).__serverTransfer === document.querySelector('[data-live-transfer-summary]'))).toBe(true);
 const input = await page.getByLabel('Retained note').elementHandle();
 const surface = await page.locator('.spatial-summary-surface').elementHandle();
 const root = page.locator('[data-spatial-presentation-root]');
 const before = await root.evaluate(node => ({width:parseFloat(getComputedStyle(node).width), query:parseFloat(getComputedStyle(node.querySelector('[data-spatial-summary-root]')!).width)}));
 await page.getByLabel('Retained note').fill('Survives the route');
 await page.getByRole('button', {name:'Add retained quantity'}).click();
 await page.getByRole('link', {name:'Navigate to destination'}).click();
 await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase','frozen');
 const frozen = await root.evaluate(node => ({width:parseFloat(getComputedStyle(node).width), query:parseFloat(getComputedStyle(node.querySelector('[data-spatial-summary-root]')!).width)}));
 expect(frozen).toEqual(before);
 await page.getByRole('button', {name:'Finish source motion'}).click();
 await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase','adopted');
 expect(await input!.evaluate(node => node === document.querySelector('input'))).toBe(true);
 expect(await surface!.evaluate(node => node.isConnected && node === document.querySelector('.spatial-summary-surface'))).toBe(true);
 await expect(page.getByLabel('Retained note')).toHaveValue('Survives the route');
 await expect(page.locator('[data-transfer-state]')).toHaveText('Survives the route: 2');
 await page.getByRole('button', {name:'Add retained quantity'}).click();
 await expect(page.locator('[data-transfer-state]')).toHaveText('Survives the route: 3');
 expect(await page.locator('[data-transfer-fields]').evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(2);
 await expect(page.locator('[data-spatial-presentation-root]')).toHaveCount(1);
 const native = await page.locator('[data-transfer-destination]').evaluate(node => ({height:node.getBoundingClientRect().height, content:node.firstElementChild!.getBoundingClientRect().height}));
 expect(native.height).toBe(native.content);
 expect(native.height).toBeGreaterThan(0);
 const following = await page.locator('[data-transfer-after]').boundingBox();
 const destination = await page.locator('[data-transfer-destination]').boundingBox();
 expect(following!.y).toBeGreaterThanOrEqual(destination!.y + destination!.height);
 await page.getByRole('link', {name:'Leave owner'}).click();
 await expect.poll(() => page.evaluate(() => (window as any).__presentationProof)).toEqual({mounts:2,destroys:2});
 expect(errors).toEqual([]);
});

test('the production card remains the same complete island until the destination content is revealed', async ({ page }) => {
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.addInitScript(() => Object.defineProperty(navigator, 'gpu', { value: undefined }));
 await page.goto('/proof/presentation-transfer/card');
 await expect(page.locator('.stage')).toHaveAttribute('data-stage-state','fallback');
 const card = await page.locator('[data-catalog-card]').elementHandle();
 const surface = await page.locator('.spatial-element-card-surface').elementHandle();
 const title = await page.locator('[data-catalog-card] h3').elementHandle();
 await page.locator('[data-catalog-card]').click();
 await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase','frozen');
 await page.getByRole('button', {name:'Finish source motion'}).click();
 await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase','content');
 expect(await card!.evaluate(node => node.isConnected && node === document.querySelector('[data-transfer-projection] [data-catalog-card]'))).toBe(true);
 expect(await surface!.evaluate(node => node.isConnected)).toBe(true);
 expect(await title!.evaluate(node => node.isConnected)).toBe(true);
 expect(await card!.evaluate(node => getComputedStyle(node).transformStyle)).toBe('preserve-3d');
 await card!.evaluate(node => (node as HTMLElement).click());
 await expect(page).toHaveURL(/presentation-transfer\/detail$/);
 await page.getByRole('button', {name:'Finish content reveal'}).click();
 await expect(page.locator('[data-transfer-proof]')).toHaveAttribute('data-phase','released');
 expect(await card!.evaluate(node => node.isConnected)).toBe(false);
 await expect(page.locator('[data-spatial-presentation-root]')).toHaveCount(1);
 expect(errors).toEqual([]);
});
