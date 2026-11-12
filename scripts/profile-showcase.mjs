import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Profile the production website with real animation frames. Keep the browser,
// viewport and adapter in the report: these numbers are comparisons, not a
// portable hardware benchmark. Build the website before running this script.
const label = process.argv[2] ?? 'showcase';
if (!/^[a-z\d_-]+$/i.test(label)) throw Error('Use an alphanumeric run label');
const width = Number(process.env.PROFILE_WIDTH ?? 1700);
const height = Number(process.env.PROFILE_HEIGHT ?? 900);
const port = Number(process.env.PROFILE_PORT ?? 4237);
const product = process.env.PROFILE_PRODUCT ?? 'tool-check-plus';
if (!/^[a-z\d-]+$/i.test(product)) throw Error('Use a product slug for PROFILE_PRODUCT');
const output = new URL('../.artifacts/performance/', import.meta.url);
await mkdir(output, { recursive: true });
const server = spawn(process.execPath, [
  fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)),
  'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'
], {
  cwd: fileURLToPath(new URL('../apps/website/', import.meta.url)),
  windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
try {
  for (let attempt = 0; ; attempt++) {
    try { if ((await fetch(`http://127.0.0.1:${port}/`)).ok) break; } catch {}
    if (attempt === 100 || server.exitCode !== null) throw Error(serverLog);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width, height }, deviceScaleFactor: Number(process.env.PROFILE_DPR ?? 1),
    reducedMotion: 'no-preference'
  });
  await context.addInitScript(() => {
    window.__showcaseProfile = { active: false, frames: [], longTasks: [], styleReads: 0, last: 0, minScroll: 0, maxScroll: 0 };
    const getStyle = window.getComputedStyle;
    window.getComputedStyle = (...args) => {
      if (window.__showcaseProfile.active) window.__showcaseProfile.styleReads++;
      return getStyle(...args);
    };
    const sample = time => {
      const state = window.__showcaseProfile;
      if (state.active && state.last) state.frames.push({
        ms: time - state.last,
        phase: document.querySelector('.stage')?.dataset.catalogTransition ?? 'settled'
      });
      if (state.active) {
        state.minScroll = Math.min(state.minScroll, scrollY);
        state.maxScroll = Math.max(state.maxScroll, scrollY);
      }
      state.last = state.active ? time : 0;
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.__showcaseProfileObserver = new PerformanceObserver(list => {
      if (window.__showcaseProfile.active) window.__showcaseProfile.longTasks.push(
        ...list.getEntries().map(entry => ({ start: entry.startTime, ms: entry.duration }))
      );
    });
    window.__showcaseProfileObserver.observe({ type: 'longtask' });
  });
  const page = await context.newPage();
  const errors = [];
  const failedRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) failedRequests.push({ url: response.url(), status: response.status() });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const metrics = async () => Object.fromEntries(
    (await cdp.send('Performance.getMetrics')).metrics.map(metric => [metric.name, metric.value])
  );
  const snapshot = () => page.evaluate(() => ({
    url: location.href,
    navigation: window.__stageVisualTest?.getNavigationTimings(),
    catalog: window.__stageVisualTest?.getCatalogStats(),
    visibility: window.__stageVisualTest?.getVisibilityStats(),
    render: window.__stageVisualTest?.getRenderActivity(),
    scrollY,
    cards: document.querySelectorAll('[data-catalog-card]').length,
    preparedModels: document.querySelectorAll('[data-catalog-model-ready]').length
  }));
  const ready = async () => {
    await page.waitForFunction(() => document.querySelector('.stage')?.getAttribute('data-stage-state') === 'enhanced', null, { timeout: 120000 });
    await page.waitForFunction(() => document.querySelector('[data-catalog-model-ready]'), null, { timeout: 120000 });
    await page.waitForTimeout(1800);
  };
  await page.goto(`http://127.0.0.1:${port}/showcase/?stage-test=1`);
  await ready();
  const environment = await page.evaluate(async product => {
    const adapter = await navigator.gpu?.requestAdapter();
    return { product, userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, deviceScaleFactor: devicePixelRatio,
      adapter: adapter ? { vendor: adapter.info.vendor, architecture: adapter.info.architecture, description: adapter.info.description } : null };
  }, product);
  const scenarios = [];
  const save = () => writeFile(new URL(`${label}.json`, output), JSON.stringify({ environment, errors, failedRequests, scenarios }, null, 2));
  const measure = async (name, action) => {
    const before = await metrics();
    const initial = await snapshot();
    if (process.env.PROFILE_CPU === name) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
    await page.evaluate(() => Object.assign(window.__showcaseProfile, {
      active: true, frames: [], longTasks: [], styleReads: 0, last: 0, minScroll: scrollY, maxScroll: scrollY
    }));
    const started = performance.now();
    await action();
    const duration = performance.now() - started;
    const sample = await page.evaluate(() => {
      const result = window.__showcaseProfile;
      result.longTasks.push(...window.__showcaseProfileObserver.takeRecords().map(entry => ({ start: entry.startTime, ms: entry.duration })));
      result.active = false;
      return result;
    });
    const after = await metrics();
    if (process.env.PROFILE_CPU === name) {
      const { profile } = await cdp.send('Profiler.stop');
      await writeFile(new URL(`${label}-${name}.cpuprofile`, output), JSON.stringify(profile));
    }
    const summarize = frames => {
      const sorted = frames.map(frame => frame.ms).sort((a, b) => a - b);
      const percentile = p => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
      return { count: sorted.length, median: percentile(0.5), p95: percentile(0.95), max: sorted.at(-1), over50ms: sorted.filter(n => n > 50).length };
    };
    const result = { name, duration, frameMs: summarize(sample.frames), scrollRange: sample.maxScroll - sample.minScroll,
      phases: Object.fromEntries([...new Set(sample.frames.map(frame => frame.phase))].map(phase => [phase, summarize(sample.frames.filter(frame => frame.phase === phase))])),
      styleReads: sample.styleReads, longTasks: sample.longTasks,
      cpuMs: Object.fromEntries(['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration'].map(key => [key, (after[key] - before[key]) * 1000])),
      counts: Object.fromEntries(['LayoutCount', 'RecalcStyleCount'].map(key => [key, after[key] - before[key]])),
      initial, final: await snapshot()
    };
    scenarios.push(result);
    await save();
    console.log(JSON.stringify({ name, duration, frameMs: result.frameMs, phases: result.phases,
      scrollRange: result.scrollRange, styleReads: result.styleReads, cpuMs: result.cpuMs,
      captureMs: result.final.navigation?.captured - result.final.navigation?.dataReady,
      residentBytes: result.final.catalog?.estimatedResidentBytes, cards: result.final.cards }));
  };
  const scroll = async () => {
    await page.mouse.move(width - 40, height / 2);
    for (let n = 0; n < 40; n++) { await page.mouse.wheel(0, n < 20 ? 70 : -70); await page.waitForTimeout(32); }
    await page.waitForTimeout(500);
  };
  await measure('grid-scroll', scroll);
  await page.evaluate(() => scrollTo(0, 0));
  // Keep the product fixed when catalog ordering or the collection size changes.
  const card = page.locator(`a[data-catalog-card][data-spatial-element-id="${product}"]`).first();
  await card.scrollIntoViewIfNeeded();
  await ready();
  await card.hover();
  await page.waitForTimeout(1500);
  await measure('grid-to-detail', async () => {
    await card.click();
    await page.waitForURL(new RegExp(`/showcase/elements/${product}/?$`));
    await page.waitForFunction(() => !document.querySelector('[data-catalog-transition]') && window.__stageVisualTest?.getCatalogPresentation()?.representations.state === 'high', null, { timeout: 120000 });
    await page.waitForTimeout(500);
  });
  await page.waitForTimeout(1500);
  await measure('detail-to-grid', async () => {
    await page.goBack();
    await page.waitForURL(/\/showcase\/\?stage-test=1$/);
    await page.waitForFunction(() => !document.querySelector('[data-catalog-transition]'), null, { timeout: 120000 });
    await page.waitForTimeout(500);
  });
  await page.goto(`http://127.0.0.1:${port}/showcase/categories/carousel/?stage-test=1`);
  await ready();
  await measure('carousel-scroll', scroll);
  await save();
  console.log(`Saved ${fileURLToPath(new URL(`${label}.json`, output))}`);
} finally {
  await browser?.close();
  server.kill();
}
