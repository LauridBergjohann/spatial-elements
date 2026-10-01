import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Use a production build. Frame intervals are wall-clock measurements, not
// synthetic stage-test frames. Chrome may use a different adapter than a user's
// normal browser, so persist adapter and viewport data alongside every run.
const label = process.argv[2] ?? 'profile';
if (!/^[a-z\d_-]+$/i.test(label)) throw new Error('Use a simple alphanumeric run label');
const width = Number(process.env.PROFILE_WIDTH ?? 1500);
const height = Number(process.env.PROFILE_HEIGHT ?? 900);
const deviceScaleFactor = Number(process.env.PROFILE_DPR ?? 2);
const port = Number(process.env.PROFILE_PORT ?? 4175);
const outputDirectory = new URL('../.artifacts/performance/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });
const server = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
 cwd: fileURLToPath(new URL('../apps/sveltekit-demo/', import.meta.url)), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
});
let serverLog = '';
server.stdout.on('data', chunk => { serverLog += chunk; });
server.stderr.on('data', chunk => { serverLog += chunk; });
let browser;
try {
 for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(`http://127.0.0.1:${port}`)).ok) break; } catch {}
  if (attempt === 100 || server.exitCode !== null) throw new Error(serverLog);
  await new Promise(resolve => setTimeout(resolve, 100));
 }
 browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
 const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor });
 await context.addInitScript(() => {
  window.__profileAdapters = [];
  if (navigator.gpu) {
   const requestAdapter = navigator.gpu.requestAdapter.bind(navigator.gpu);
   navigator.gpu.requestAdapter = async options => {
    const adapter = await requestAdapter(options);
    if (adapter) window.__profileAdapters.push({ options, vendor: adapter.info.vendor, architecture: adapter.info.architecture, device: adapter.info.device, description: adapter.info.description });
    return adapter;
   };
  }
  window.__profile = { active: false, frames: [], phases: [], longTasks: [], last: 0, maxFocus: 0, minScrollY: 0, maxScrollY: 0 };
  const tick = time => {
   const p = window.__profile;
   if (p.active && p.last) {
    p.frames.push(time - p.last);
    p.phases.push(p.phase);
   }
   p.phase = document.querySelector('.stage')?.getAttribute('data-catalog-transition') ?? 'settled';
   if (p.active) {
    p.maxFocus = Math.max(p.maxFocus, window.__stageVisualTest?.getState().focus ?? 0);
    p.minScrollY = Math.min(p.minScrollY, scrollY);
    p.maxScrollY = Math.max(p.maxScrollY, scrollY);
   }
   p.last = p.active ? time : 0;
   requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  window.__profileObserver = new PerformanceObserver(list => {
   if (window.__profile.active) window.__profile.longTasks.push(...list.getEntries().map(e => ({ start: e.startTime, duration: e.duration })));
  });
  window.__profileObserver.observe({ type: 'longtask', buffered: false });
 });
 const page = await context.newPage();
 const errors = [];
 page.on('pageerror', error => errors.push(error.message));
 const cdp = await context.newCDPSession(page);
 await cdp.send('Performance.enable');
 const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
 const snapshot = () => page.evaluate(() => ({
  targets: window.__stageVisualTest?.getRenderTargetStats(),
  visibility: window.__stageVisualTest?.getVisibilityStats(),
  catalog: window.__stageVisualTest?.getCarouselStats(),
  navigation: window.__stageVisualTest?.getNavigationTimings(),
  zoom: window.__stageVisualTest?.getState(),
  scrollY
 }));
 const scenarios = [];
 const measure = async (name, action) => {
  const before = await metrics();
  const initial = await snapshot();
  const profileCpu = process.env.PROFILE_CPU === name;
  if (profileCpu) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.start'); }
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(time => {
   Object.assign(window.__profile, { active: true, frames: [], phases: [], longTasks: [], last: time, maxFocus: 0, minScrollY: scrollY, maxScrollY: scrollY });
   resolve();
  })));
  const start = performance.now();
  const actionMetadata = await action();
  const duration = performance.now() - start;
  const sample = await page.evaluate(() => {
   window.__profile.longTasks.push(...window.__profileObserver.takeRecords().map(e => ({ start: e.startTime, duration: e.duration })));
   window.__profile.active = false;
   return window.__profile;
  });
  const after = await metrics();
  if (profileCpu) {
   const { profile } = await cdp.send('Profiler.stop');
   await writeFile(new URL(`${label}-${name}.cpuprofile`, outputDirectory), JSON.stringify(profile));
  }
  const sorted = [...sample.frames].sort((a,b) => a-b);
  const percentile = p => sorted[Math.min(sorted.length-1, Math.floor(sorted.length*p))] ?? 0;
  const phases = Object.fromEntries([...new Set(sample.phases)].map(phase => {
   const frames = sample.frames.filter((_, i) => sample.phases[i] === phase).sort((a,b) => a-b);
   return [phase, { frames: frames.length, median: frames[Math.floor(frames.length * .5)], p95: frames[Math.floor(frames.length * .95)], max: frames.at(-1) }];
  }));
  const result = { name, duration, actionMetadata, phases, maxFocus: sample.maxFocus, scrollRange: sample.maxScrollY - sample.minScrollY, frames: sorted.length, frameMs: { median: percentile(.5), p95: percentile(.95), max: sorted.at(-1) ?? 0 }, over25ms: sorted.filter(n=>n>25).length, over50ms: sorted.filter(n=>n>50).length,
   longTasks: sample.longTasks, cpuMs: Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration'].map(key=>[key, (after[key]-before[key])*1000])),
   counts: Object.fromEntries(['LayoutCount','RecalcStyleCount'].map(key=>[key, after[key]-before[key]])), initial, final: await snapshot() };
  scenarios.push(result);
  await writeFile(new URL(`${label}.json`, outputDirectory), JSON.stringify({ environment, errors, scenarios }, null, 2));
  console.log(JSON.stringify({ name, maxFocus: result.maxFocus, scrollRange: result.scrollRange, frames: result.frames, frameMs: result.frameMs, phases, cpuMs: result.cpuMs, counts: result.counts }));
  if (name.endsWith('-scroll') && result.scrollRange < 100) throw new Error('Scroll gesture did not move the page');
  if (name.endsWith('-zoom') && !(actionMetadata?.peak?.rect?.width > actionMetadata?.before?.width * 1.05)) throw new Error('Wheel gesture did not enlarge the model');
  if (name.endsWith('-closeup') && result.maxFocus < 0.8) throw new Error('Wheel gesture did not reach close-up');
 };
 await page.goto(`http://127.0.0.1:${port}/demo/categories/list?stage-test=1`);
 await page.waitForFunction(() => window.__stageVisualTest && document.querySelector('[data-catalog-model-ready]'));
 const environment = await page.evaluate(async () => {
  const rendererAdapterRequests = [...window.__profileAdapters];
  const adapter = await navigator.gpu?.requestAdapter();
  const high = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
  const info = a => a ? { vendor: a.info.vendor, architecture: a.info.architecture, device: a.info.device, description: a.info.description, isFallbackAdapter: a.info.isFallbackAdapter } : null;
  return { userAgent: navigator.userAgent, width: innerWidth, height: innerHeight, devicePixelRatio, rendererAdapterRequests, defaultAdapter: info(adapter), highPerformanceAdapter: info(high) };
 });
 console.log(JSON.stringify({ environment }));
 const settle = () => page.waitForTimeout(2000);
 const waitDetail = async () => {
  await page.waitForURL(/elements\/column/);
  await page.waitForFunction(() => !document.querySelector('[data-catalog-transition]') && window.__stageVisualTest?.getCatalogPresentation()?.representations.state === 'high');
 };
 await settle();
 for (const view of ['list', 'carousel']) {
  if (view === 'carousel') {
   await page.goto(`http://127.0.0.1:${port}/demo/categories/carousel?stage-test=1`);
   await page.waitForFunction(() => window.__stageVisualTest && document.querySelector('[data-catalog-model-ready]'));
   await settle();
  }
  const target = view === 'carousel' ? page.locator('[data-carousel-item="column"] .information').first() : page.locator('[data-catalog-card][data-spatial-element-id="column"]').first();
  await target.scrollIntoViewIfNeeded();
  await settle();
  await measure(`${view}-to-detail`, async () => { await target.click(); await waitDetail(); await page.waitForTimeout(500); });
  await settle();
  await measure(`${view}-detail-scroll`, async () => {
   await page.mouse.move(width - 60, height / 2);
   for (let n=0; n<36; n++) { await page.mouse.wheel(0, n < 18 ? 65 : -65); await page.waitForTimeout(32); }
   await page.waitForTimeout(300);
  });
  await settle();
  await measure(`${view}-detail-zoom`, async () => {
   const rect = await page.evaluate(() => window.__stageVisualTest?.getModelRect());
   await page.mouse.move(rect ? rect.x + rect.width / 2 : width / 2, rect ? rect.y + rect.height / 2 : height / 2);
   let peak;
   for (let n=0; n<30; n++) {
    await page.mouse.wheel(0, n < 15 ? -45 : 45);
    await page.waitForTimeout(32);
    if (n === 14) peak = await page.evaluate(() => ({ zoom: window.__stageVisualTest?.getState(), rect: window.__stageVisualTest?.getModelRect(), scrollY }));
   }
   await page.waitForTimeout(600);
   return { before: rect, peak };
  });
  if (process.env.PROFILE_CLOSEUP !== '0') {
   await measure(`${view}-detail-closeup`, async () => {
    const rect = await page.evaluate(() => window.__stageVisualTest.getModelRect());
    if (!rect) throw new Error('No model bounds for zoom gesture');
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    for (let n=0; n<40; n++) { await page.mouse.wheel(0, -150); await page.waitForTimeout(32); }
    await page.waitForTimeout(600);
    return page.evaluate(() => ({ zoom: window.__stageVisualTest.getState(), rect: window.__stageVisualTest.getModelRect(), scrollY }));
   });
  }
 }
 const output = new URL(`../.artifacts/performance/${label}.json`, import.meta.url);
 await mkdir(new URL('./', output), { recursive: true });
 await writeFile(output, JSON.stringify({ environment, errors, scenarios }, null, 2));
 console.log(`Saved ${fileURLToPath(output)}`);
} finally {
 await browser?.close();
 server.kill();
}
