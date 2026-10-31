#!/usr/bin/env node
// Diagnostic only: queue fences and tracing add overhead; never use this run for latency acceptance.
// Run against an already running production preview; this script owns and closes only its browser.
// Low-overhead attribution: --view=list --temperature=warm --minimal=true --cpu=true
// --fences=false is a control without added queue fences; GPU/Viz tracing remains enabled.
// --constantIncomingDom=true disables only the incoming DOM fade during reveal for causal attribution.
// This deliberately changes the presentation and is not a product or acceptance configuration.
// --localIncomingDom=true redirects the same fade values to existing DOM/group receivers instead.
// These two diagnostic modes are mutually exclusive; neither changes production code.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const [key, ...value] = arg.replace(/^--/, '').split('='); return [key, value.join('=')];
}));
const baseURL = args.url ?? 'http://127.0.0.1:4202';
const view = args.view ?? 'carousel', temperature = args.temperature ?? 'cold';
if (!['list', 'carousel'].includes(view) || !['cold', 'warm'].includes(temperature)) throw Error('Invalid view/temperature');
const minimal = args.minimal === 'true', sampleCpu = args.cpu === 'true';
const probeFences = args.fences !== 'false';
const constantIncomingDom = args.constantIncomingDom === 'true';
const localIncomingDom = args.localIncomingDom === 'true';
if (constantIncomingDom && localIncomingDom) throw Error('constantIncomingDom and localIncomingDom are mutually exclusive');
const cpuSamplingInterval = Number(args.cpuInterval ?? 1000);
if (!Number.isInteger(cpuSamplingInterval) || cpuSamplingInterval < 100) throw Error('Invalid CPU sampling interval in microseconds');
const output = resolve(args.output ?? `.artifacts/staged-gpu-trace-${view}-${temperature}`);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome', headless: true });
let tracing = false;
let profiling = false, pageSession;
const browserSession = await browser.newBrowserCDPSession();
try {
  const systemInfo = await browserSession.send('SystemInfo.getInfo');
  const commandLine = await browserSession.send('Browser.getBrowserCommandLine').catch(error => ({ unavailable: error.message }));
  const context = await browser.newContext({ baseURL, viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ minimal, probeFences, constantIncomingDom, localIncomingDom }) => {
    Error.stackTraceLimit = 40;
    const probe = { active: false, phase: '', submits: [], fences: [], frames: [], longFrames: [], gpuCreates: [], errors: [],
      constantIncomingDom: { enabled: constantIncomingDom, interceptedWrites: 0, appliedWrites: 0 },
      localIncomingDom: { enabled: localIncomingDom, interceptedWrites: 0, appliedRootWrites: 0, localWrites: 0, restoredProperties: 0, pendingReceivers: 0 } };
    Object.assign(window, { gpuProbe: probe });
    const views = new WeakMap(), encoders = new WeakMap(), buffers = new WeakMap(), shaders = new WeakMap(), pendingFences = new WeakSet();
    let stage;
    const phase = () => { stage ??= document.querySelector('.stage'); return stage?.dataset.catalogStagedPhase ?? ''; };
    let restoreLocalIncomingDom = () => {};
    if (constantIncomingDom || localIncomingDom) {
      const setProperty = CSSStyleDeclaration.prototype.setProperty;
      const removeProperty = CSSStyleDeclaration.prototype.removeProperty;
      const localOriginals = new Map();
      restoreLocalIncomingDom = () => {
        for (const [element, properties] of localOriginals) for (const [property, original] of properties) {
          if (original.value) setProperty.call(element.style, property, original.value, original.priority);
          else removeProperty.call(element.style, property);
          probe.localIncomingDom.restoredProperties++;
        }
        localOriginals.clear();
        probe.localIncomingDom.pendingReceivers = 0;
      };
      if (localIncomingDom) {
        const removeAttribute = Element.prototype.removeAttribute;
        Element.prototype.removeAttribute = function (...args) {
          // Restore synchronously with cleanup, before another navigation can
          // freeze the next source. A MutationObserver alone would run too late.
          if (this === stage && args[0] === 'data-catalog-staged-phase') restoreLocalIncomingDom();
          return removeAttribute.apply(this, args);
        };
        window.addEventListener('pagehide', restoreLocalIncomingDom);
      }
      CSSStyleDeclaration.prototype.setProperty = function (...args) {
        const [property] = args;
        if (probe.active && (property === '--catalog-enter-opacity' || property === '--catalog-shared-opacity') &&
          phase() === 'revealing' && this === stage.style) {
          if (localIncomingDom) {
            probe.localIncomingDom.interceptedWrites++;
            // A constant root fallback keeps unmarked/newly mounted descendants
            // usable. Every existing framework receiver gets the exact requested
            // value locally, including nested markers on frame/surface/content.
            if (this.getPropertyValue(property) !== '1') {
              setProperty.call(this, property, '1', args[2] ?? '');
              probe.localIncomingDom.appliedRootWrites++;
            }
            const selector = property === '--catalog-enter-opacity'
              ? '[data-catalog-transition-dom="enter"], [data-catalog-transition-group="enter"]'
              : '[data-catalog-transition-group="shared"]';
            // Re-read on every intercepted write: no cached target census can
            // silently miss a receiver mounted during the content reveal.
            for (const element of stage.querySelectorAll(selector)) {
              if (!element.style) continue;
              let properties = localOriginals.get(element);
              if (!properties) localOriginals.set(element, properties = new Map());
              if (!properties.has(property)) properties.set(property, {
                value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property)
              });
              setProperty.call(element.style, property, args[1], args[2] ?? '');
              probe.localIncomingDom.localWrites++;
            }
            probe.localIncomingDom.pendingReceivers = localOriginals.size;
            return;
          }
          probe.constantIncomingDom.interceptedWrites++;
          // Keep GPU progress, source fade and phase mutations untouched. Only the
          // two inherited incoming DOM values become constant after their first write.
          if (this.getPropertyValue(property) === '1') return;
          args[1] = '1';
          probe.constantIncomingDom.appliedWrites++;
        }
        return setProperty.apply(this, args);
      };
    }
    let sequence = 0;
    if (!minimal && globalThis.GPUTexture) {
      const original = GPUTexture.prototype.createView;
      GPUTexture.prototype.createView = function (...args) {
        const result = original.apply(this, args);
        views.set(result, { width: this.width, height: this.height, format: this.format, samples: this.sampleCount, label: this.label });
        return result;
      };
    }
    if (!minimal && globalThis.GPUCommandEncoder) {
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
        const descriptor = args[0];
        const entry = probe.active ? { method, time: performance.now(), phase: phase() } : undefined;
        if (entry) {
          if (method === 'createShaderModule') entry.shader = { label: descriptor.label, ...(minimal ? {} : { code: descriptor.code }) };
          else if (method.startsWith('createRenderPipeline')) {
            entry.pipeline = { label: descriptor.label, vertex: shaders.get(descriptor.vertex?.module), fragment: shaders.get(descriptor.fragment?.module),
              targets: descriptor.fragment?.targets, depthStencil: descriptor.depthStencil, multisample: descriptor.multisample, primitive: descriptor.primitive };
            entry.stack = new Error().stack;
          } else if (method === 'createTexture') {
            entry.texture = { size: descriptor.size, format: descriptor.format, samples: descriptor.sampleCount, usage: descriptor.usage, label: descriptor.label };
            entry.stack = new Error().stack;
          }
          else entry.buffer = { size: descriptor.size, usage: descriptor.usage, label: descriptor.label };
          probe.gpuCreates.push(entry);
        }
        const result = original.apply(this, args);
        if (!minimal && method === 'createShaderModule') shaders.set(result, { label: descriptor.label, code: descriptor.code });
        if (entry) entry.returned = performance.now();
        return result;
      };
    }
    if (globalThis.GPUQueue) {
      const submit = GPUQueue.prototype.submit, done = GPUQueue.prototype.onSubmittedWorkDone;
      GPUQueue.prototype.submit = function (commands) {
        if (!probe.active) return submit.call(this, commands);
        const list = minimal ? commands : Array.from(commands), id = ++sequence, start = performance.now();
        if (!minimal) performance.mark(`staged-submit-${id}`);
        const result = submit.call(this, list);
        probe.submits.push({ id, start, returned: performance.now(), phase: phase(),
          ...(minimal ? {} : { passes: list.flatMap(command => buffers.get(command) ?? []) }) });
        if (probeFences && !pendingFences.has(this)) {
          pendingFences.add(this);
          queueMicrotask(() => {
            pendingFences.delete(this);
            const throughSubmit = sequence, requested = performance.now();
            const fence = { throughSubmit, requested, phase: phase(), completed: null, duration: null };
            probe.fences.push(fence);
            performance.mark(`staged-fence-request-${throughSubmit}`);
            done.call(this).then(() => {
              const completed = performance.now();
              performance.mark(`staged-fence-complete-${throughSubmit}`);
              fence.completed = completed; fence.duration = completed - requested;
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
      probe.phase = phase();
      if (probe.active) probe.frames.push({ rafTime: time, observed: performance.now(), phase: probe.phase });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    new MutationObserver(() => {
      const phase = document.querySelector('.stage')?.dataset.catalogStagedPhase ?? '';
      if (localIncomingDom && phase !== 'revealing' && phase !== 'committing') restoreLocalIncomingDom();
      if (phase !== probe.phase) { probe.phase = phase; if (probe.active) performance.mark(`staged-phase-${phase || 'none'}`); }
    }).observe(document, { attributes: true, subtree: true, attributeFilter: ['data-catalog-staged-phase'] });
  }, { minimal, probeFences, constantIncomingDom, localIncomingDom });
  const page = await context.newPage();
  page.on('pageerror', error => process.stderr.write(`${error.message}\n`));
  await page.goto(`/staged/categories/${view}?stage-test=1&stagedNavigation=1`);
  if (args.promote === 'true') await page.addStyleTag({ content: '.interactive.selected .summary, .interactive.selected .spatial-summary-island { will-change: transform; }' });
  if (args.prepareDom === 'true') await page.addStyleTag({ content: `
    .stage[data-catalog-staged-phase='held'] {
      --catalog-enter-opacity: 0.001 !important;
      --catalog-shared-opacity: 0.001 !important;
    }
    .stage[data-catalog-staged-phase='held'] :is([data-catalog-transition-dom='enter'], [data-catalog-transition-group='enter'], [data-catalog-transition-group='shared']) {
      visibility: visible !important;
    }
  ` });
  await page.waitForFunction(() => window.__stageVisualTest?.getCarouselStats()?.actors.some(actor => actor.spatialElementId === 'column' && actor.stagedReady), undefined, { timeout: 60000 });
  const link = page.locator(view === 'list' ? '[data-catalog-card][data-spatial-element-id="column"]' : '[data-carousel-item="column"] .spatial-element-target').first();
  await link.evaluate(node => { const url = new URL(node.href); url.hash = ''; node.href = url.href; });
  if (temperature === 'warm') {
    const data = page.waitForResponse(response => response.url().includes('/staged/elements/column/__data.json'));
    await link.hover(); await data; await page.waitForLoadState('networkidle');
  }
  const { categories: available } = await browserSession.send('Tracing.getCategories');
  const requested = ['toplevel', 'gpu', 'gpu.angle', 'viz', 'cc', 'benchmark', 'blink', 'blink.user_timing', 'renderer.scheduler', 'devtools.timeline', 'v8.execute',
    'disabled-by-default-gpu.service', 'disabled-by-default-gpu.device', 'disabled-by-default-gpu.dawn',
    ...(minimal ? [] : ['disabled-by-default-gpu.debug', 'disabled-by-default-viz.debug']),
    'disabled-by-default-devtools.timeline.frame'];
  const categories = available.length ? requested.filter(name => available.includes(name)) : requested;
  pageSession = await context.newCDPSession(page);
  await pageSession.send('Performance.enable');
  const clockMetrics = await pageSession.send('Performance.getMetrics');
  const sourceStyles = await page.locator('.interactive.selected .summary, .interactive.selected .spatial-summary-island').evaluateAll(nodes => nodes.map(node => ({
    className: node.className, willChange: getComputedStyle(node).willChange, transform: getComputedStyle(node).transform
  })));
  if (sampleCpu) {
    await pageSession.send('Profiler.enable');
    await pageSession.send('Profiler.setSamplingInterval', { interval: cpuSamplingInterval });
  }
  await browserSession.send('Tracing.start', { categories: categories.join(','), transferMode: 'ReturnAsStream', options: 'record-as-much-as-possible' });
  tracing = true;
  if (sampleCpu) { await pageSession.send('Profiler.start'); profiling = true; }
  await page.evaluate(() => { window.gpuProbe.active = true; performance.mark('staged-probe-start'); });
  await link.evaluate(node => { performance.mark('staged-click'); node.click(); });
  await page.waitForFunction(() => (window.__stageVisualTest?.getNavigationTimings().early?.revealed ?? 0) > 0, undefined, { timeout: 60000 });
  await page.waitForFunction(() => window.gpuProbe.frames.at(-1)?.rafTime >= window.__stageVisualTest.getNavigationTimings().early.revealEnded, undefined, { timeout: 30000 });
  await page.evaluate(async () => { await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  const report = await page.evaluate(() => {
    window.gpuProbe.active = false;
    const timings = window.__stageVisualTest.getNavigationTimings().early;
    const intervals = {
      beforeMotion: [timings.started, timings.firstMotion], moving: [timings.firstMotion, timings.motionEnded],
      beforeReveal: [timings.motionEnded, timings.revealStarted], reveal: [timings.revealStarted, timings.revealEnded],
      afterReveal: [timings.revealEnded, timings.revealed]
    };
    const phases = Object.fromEntries(Object.entries(intervals).map(([name, [start, end]]) => [name, {
      start, end, duration: end - start,
      // Exact timing wins over a MutationObserver's later phase notification.
      gpuCreates: window.gpuProbe.gpuCreates.filter(call => call.time >= start && call.time < end),
      submits: window.gpuProbe.submits.filter(call => call.start >= start && call.start < end).length,
      rafObservations: window.gpuProbe.frames.filter(frame => frame.observed >= start && frame.observed <= end).length
    }]));
    return { timings, phases, catalog: window.__stageVisualTest.getCarouselStats(), probe: window.gpuProbe };
  });
  if (profiling) {
    const { profile } = await pageSession.send('Profiler.stop'); profiling = false;
    await writeFile(join(output, 'cpu.cpuprofile'), JSON.stringify(profile));
  }
  await writeFile(join(output, 'probe.json'), JSON.stringify({ view, temperature,
    instrumentation: { minimal, sampleCpu, cpuSamplingInterval: sampleCpu ? cpuSamplingInterval : null, probeFences,
      constantIncomingDom, localIncomingDom, alteredPresentation: constantIncomingDom || localIncomingDom,
      incomingDomPolicy: constantIncomingDom ? 'Diagnostic only: during revealing, clamp the two Stage incoming opacity variables to 1 and omit repeated writes. Incoming DOM does not fade; not a product candidate.'
        : localIncomingDom ? 'Diagnostic only: root incoming opacity stays at 1; the exact requested values are written to all current enter/shared framework receivers on every write, retaining nested scopes. No wrapper opacity or layer promotion. Original inline values/priorities restore on finish/cancel.'
        : 'Unmodified incoming DOM fade.',
      incomingDomLimitations: localIncomingDom ? 'Not general semantic equivalence: receiver-local authored declarations are temporarily overridden; unmarked custom consumers and nodes created between writes see the constant root fallback until their next intercepted write. Selector queries and additional local writes add probe CPU overhead. No production or latency-acceptance claim.' : null,
      latencyAcceptance: false, fencePolicy: probeFences ? 'One additional asynchronous queue fence per synchronous submission batch; never awaited by application code.' : 'No additional queue fences.' },
    promotion: args.promote === 'true', prepareDom: args.prepareDom === 'true', sourceStyles, categories, clockMetrics, systemInfo, commandLine, browser: browser.version(), ...report }, null, 2));
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
  if (profiling) await pageSession?.send('Profiler.stop').catch(() => {});
  if (tracing) await browserSession.send('Tracing.end').catch(() => {});
  await browser.close();
}
