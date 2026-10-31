#!/usr/bin/env node
// Diagnostic only: queue fences and tracing add overhead; never use this run for latency acceptance.
// Run against an already running production preview; this script owns and closes only its browser.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')];
}));
const baseURL = args.url ?? 'http://127.0.0.1:4202';
const view = args.view ?? 'carousel', temperature = args.temperature ?? 'cold';
if (!['list', 'carousel'].includes(view) || !['cold', 'warm'].includes(temperature)) throw Error('Invalid view/temperature');
const output = resolve(args.output ?? `.artifacts/staged-gpu-trace-${view}-${temperature}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
let tracing = false;
const browserSession = await browser.newBrowserCDPSession();
try {
  const systemInfo = await browserSession.send('SystemInfo.getInfo');
  const commandLine = await browserSession.send('Browser.getBrowserCommandLine').catch(error => ({ unavailable: error.message }));
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(() => {
    const probe = { active: false, phase: '', submits: [], fences: [], frames: [], longFrames: [], gpuCreates: [], errors: [] };
    Object.assign(window, { gpuProbe: probe });
    const views = new WeakMap(), encoders = new WeakMap(), buffers = new WeakMap(), pendingFences = new WeakSet();
    let sequence = 0;
    if (globalThis.GPUTexture) {
      const original = GPUTexture.prototype.createView;
      GPUTexture.prototype.createView = function (...args) {
        const result = original.apply(this, args);
        views.set(result, { width: this.width, height: this.height, format: this.format, samples: this.sampleCount, label: this.label });
        return result;
      };
    }
    if (globalThis.GPUCommandEncoder) {
      const begin = GPUCommandEncoder.prototype.beginRenderPass, finish = GPUCommandEncoder.prototype.finish;
      GPUCommandEncoder.prototype.beginRenderPass = function (descriptor) {
        if (probe.active) {
          const passes = encoders.get(this) ?? [];
          passes.push({ label: descriptor.label, attachments: descriptor.colorAttachments?.map(attachment => attachment && ({
            ...views.get(attachment.view), resolve: views.get(attachment.resolveTarget), load: attachment.loadOp, store: attachment.storeOp
          })), depth: descriptor.depthStencilAttachment ? views.get(descriptor.depthStencilAttachment.view) : undefined });
          encoders.set(this, passes);
        }
        return begin.call(this, descriptor);
      };
      GPUCommandEncoder.prototype.finish = function (...args) {
        const result = finish.apply(this, args);
        if (probe.active) buffers.set(result, encoders.get(this) ?? []);
        return result;
      };
    }
    if (globalThis.GPUDevice) for (const method of ['createRenderPipeline', 'createRenderPipelineAsync', 'createShaderModule', 'createTexture', 'createBuffer']) {
      const original = GPUDevice.prototype[method];
      GPUDevice.prototype[method] = function (...args) {
        if (probe.active) probe.gpuCreates.push({ method, time: performance.now(), phase: probe.phase });
        return original.apply(this, args);
      };
    }
    if (globalThis.GPUQueue) {
      const submit = GPUQueue.prototype.submit, done = GPUQueue.prototype.onSubmittedWorkDone;
      GPUQueue.prototype.submit = function (commands) {
        if (!probe.active) return submit.call(this, commands);
        const list = Array.from(commands), id = ++sequence, start = performance.now();
        performance.mark(`staged-submit-${id}`);
        const result = submit.call(this, list);
        probe.submits.push({ id, start, returned: performance.now(), phase: probe.phase, passes: list.flatMap(command => buffers.get(command) ?? []) });
        if (!pendingFences.has(this)) {
          pendingFences.add(this);
          queueMicrotask(() => {
            pendingFences.delete(this);
            const throughSubmit = sequence, requested = performance.now();
            performance.mark(`staged-fence-request-${throughSubmit}`);
            done.call(this).then(() => {
              const completed = performance.now();
              performance.mark(`staged-fence-complete-${throughSubmit}`);
              probe.fences.push({ throughSubmit, requested, completed, duration: completed - requested });
            }, error => probe.errors.push(String(error)));
          });
        }
        return result;
      };
    }
    if (PerformanceObserver.supportedEntryTypes.includes('long-animation-frame')) new PerformanceObserver(list => {
      if (probe.active) probe.longFrames.push(...list.getEntries().map(entry => entry.toJSON()));
    }).observe({ type: 'long-animation-frame', buffered: true });
    const sample = time => {
      probe.phase = document.querySelector('.stage')?.dataset.catalogStagedPhase ?? '';
      if (probe.active) probe.frames.push({ rafTime: time, observed: performance.now(), phase: probe.phase });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    new MutationObserver(() => {
      const phase = document.querySelector('.stage')?.dataset.catalogStagedPhase ?? '';
      if (phase !== probe.phase) { probe.phase = phase; if (probe.active) performance.mark(`staged-phase-${phase || 'none'}`); }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-catalog-staged-phase'] });
  });
  const page = await context.newPage();
  page.on('pageerror', error => process.stderr.write(`${error.message}\n`));
  await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1`);
  if (args.promote === 'true') await page.addStyleTag({ content: '.interactive.selected .summary, .interactive.selected .spatial-summary-island { will-change: transform; }' });
  await page.waitForFunction(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady), undefined, { timeout: 60000 });
  const link = page.locator(view === 'list' ? '[data-catalog-card][data-spatial-element-id="column"]' : '[data-carousel-item="column"] .spatial-element-target').first();
  await link.evaluate(node => { const url = new URL(node.href); url.hash = ''; node.href = url.href; });
  if (temperature === 'warm') {
    const data = page.waitForResponse(response => response.url().includes('/staged/elements/column/__data.json'));
    await link.hover(); await data; await page.waitForLoadState('networkidle');
  }
  const { categories: available } = await browserSession.send('Tracing.getCategories');
  const requested = ['toplevel', 'gpu', 'gpu.angle', 'viz', 'cc', 'benchmark', 'blink', 'blink.user_timing', 'renderer.scheduler', 'devtools.timeline',
    'disabled-by-default-gpu.service', 'disabled-by-default-gpu.device', 'disabled-by-default-gpu.dawn',
    'disabled-by-default-gpu.debug', 'disabled-by-default-viz.debug', 'disabled-by-default-devtools.timeline.frame'];
  const categories = available.length ? requested.filter(name => available.includes(name)) : requested;
  const pageSession = await context.newCDPSession(page);
  await pageSession.send('Performance.enable');
  const clockMetrics = await pageSession.send('Performance.getMetrics');
  const sourceStyles = await page.locator('.interactive.selected .summary, .interactive.selected .spatial-summary-island').evaluateAll(nodes => nodes.map(node => ({
    className: node.className, willChange: getComputedStyle(node).willChange, transform: getComputedStyle(node).transform
  })));
  await browserSession.send('Tracing.start', { categories: categories.join(','), transferMode: 'ReturnAsStream', options: 'record-as-much-as-possible' });
  tracing = true;
  await page.evaluate(() => { window.gpuProbe.active = true; performance.mark('staged-probe-start'); });
  await link.evaluate(node => { performance.mark('staged-click'); node.click(); });
  await page.waitForFunction(() => (window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0) > 0, undefined, { timeout: 60000 });
  await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const report = await page.evaluate(() => {
    window.gpuProbe.active = false;
    return { timings: window.__stageVisualTest.getNavigationTimings().early, catalog: window.__stageVisualTest.getCarouselStats(), probe: window.gpuProbe };
  });
  await writeFile(join(output, 'probe.json'), JSON.stringify({ view, temperature, promotion: args.promote === 'true', sourceStyles, categories, clockMetrics, systemInfo, commandLine, browser: browser.version(), ...report }, null, 2));
  const complete = new Promise(resolve => browserSession.once('Tracing.tracingComplete', resolve));
  await browserSession.send('Tracing.end'); tracing = false;
  const { stream } = await complete;
  const chunks = [];
  while (true) {
    const { data, eof, base64Encoded } = await browserSession.send('IO.read', { handle: stream });
    chunks.push(base64Encoded ? Buffer.from(data, 'base64') : Buffer.from(data));
    if (eof) break;
  }
  await browserSession.send('IO.close', { handle: stream });
  await writeFile(join(output, 'trace.json'), Buffer.concat(chunks));
  process.stdout.write(`Trace saved to ${output}\n`);
  await context.close();
} finally {
  if (tracing) await browserSession.send('Tracing.end').catch(() => {});
  await browser.close();
}
