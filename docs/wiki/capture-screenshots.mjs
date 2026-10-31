import { chromium } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const baseURL = process.argv.find(value => value.startsWith('--base-url='))?.slice(11) ?? 'http://127.0.0.1:4174';
const directory = fileURLToPath(new URL('./images/', import.meta.url));
const onlyArgument = process.argv.find(value => value.startsWith('--only='))?.slice(7);
const only = onlyArgument ? new Set(onlyArgument.split(',')) : undefined;
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' });
const captured = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', colorScheme: 'light' });
  await page.goto(`${baseURL}/demo/elements/column?stage-test=1`);
  await page.locator('.stage[data-stage-state="enhanced"]').waitFor();
  await page.waitForFunction(() => (window.__stageVisualTest?.getModelRect()?.width ?? 0) > 0);
  for (const [name, width] of [['xs', 375], ['s', 720], ['m', 1024], ['l', 1440], ['xl', 1700], ['2xl', 2000], ['3xl', 2456]]) {
    if (only && !only.has(`detail-${name}`)) continue;
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    // The entire free left half controls the model in 3XL; parking at its
    // bottom edge would trigger the automatic help popup in this overview.
    await page.mouse.move(width - 2, 2);
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__stageVisualTest.settle(40));
    await page.screenshot({ path: `${directory}/detail-${name}.png` });
    captured.push({ file: `detail-${name}.png`, route: '/demo/elements/column?stage-test=1', width, height: 900, mode: 'WebGPU' });
  }
  for (const [name, width] of [['cards-320', 320], ['cards-840', 840]]) {
    if (only && !only.has(name)) continue;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${baseURL}/demo/layout-cards?stage-test=1`);
    await page.locator('[data-catalog-card][data-catalog-model-ready]').first().waitFor({ state: 'attached' });
    await page.evaluate(() => window.__stageVisualTest.settle(40));
    await page.mouse.move(1, 999);
    // The renderer is viewport-sized; full-page capture would invent blank
    // offscreen geometry. Keep the real on-screen composition.
    await page.screenshot({ path: `${directory}/${name}.png` });
    captured.push({ file: `${name}.png`, route: '/demo/layout-cards?stage-test=1', width, height: 1000, mode: 'WebGPU' });
  }
  if (!only || only.has('cards-large-720')) {
    await page.setViewportSize({ width: 720, height: 1000 });
    await page.goto(`${baseURL}/demo/layout-cards?stage-test=1`);
    await page.locator('[data-catalog-card][data-catalog-model-ready]').first().waitFor({ state: 'attached' });
    await page.locator('#cards-large').evaluate(node => window.scrollTo({
      top: scrollY + node.getBoundingClientRect().top, behavior: 'instant'
    }));
    await page.mouse.move(718, 2);
    await page.evaluate(() => window.__stageVisualTest.settle(40));
    await page.screenshot({ path: `${directory}/cards-large-720.png` });
    captured.push({ file: 'cards-large-720.png', route: '/demo/layout-cards?stage-test=1#cards-large', width: 720, height: 1000, mode: 'WebGPU' });
  }
  const previous = only ? JSON.parse(await readFile(`${directory}/capture-manifest.json`, 'utf8').catch(() => '[]')) : [];
  const manifest = [...new Map([...previous, ...captured].map(entry => [entry.file, entry])).values()];
  await writeFile(`${directory}/capture-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Captured ${captured.length} public-demo figures from ${baseURL}.`);
} finally { await browser.close(); }
