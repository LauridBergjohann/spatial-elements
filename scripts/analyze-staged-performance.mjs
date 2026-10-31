#!/usr/bin/env node
// Usage: node scripts/analyze-staged-performance.mjs <artifact-directory-or-json> [--output report.json]
// Pure attribution checks: node scripts/analyze-staged-performance.mjs --self-test
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const finite = value => typeof value === 'number' && Number.isFinite(value);
const interval = (start, end) => finite(start) && finite(end) && end >= start ? { start, end } : null;
const overlap = (left, right) => left && right ? Math.max(0, Math.min(left.end, right.end) - Math.max(left.start, right.start)) : 0;
const containsTime = (range, time) => range && finite(time) && time >= range.start && time <= range.end;
const percentile = (values, fraction) => values.length ? [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1] : null;
const statistics = values => ({ count: values.length, p50: percentile(values, 0.5), p95: percentile(values, 0.95), max: values.length ? Math.max(...values) : null });
const roundoff = 1e-7; // Only absorb binary floating-point roundoff, not a frame-time tolerance.
const measurementProtocolVersion = 'staged-performance-v2';
const cadenceProtocol = Object.freeze({
  version: 'cadence-diagnostic-v1', timestampCount: 121,
  periodMinMs: 16, periodMaxMs: 17.5,
  idleGapMinPeriods: 0.75, idleGapMaxPeriods: 1.25,
  halfPeriodDifferenceMaxMs: 0.05, diagnosticHalfBandMs: 0.5
});

/** Additional interpretation only: never supplies the budget used by an acceptance gate. */
export function analyzeIdleCadence(input) {
  const timestamps = Array.isArray(input?.timestamps) ? [...input.timestamps] : null;
  const result = {
    version: cadenceProtocol.version, recordedVersion: input?.version ?? null,
    status: 'indeterminate', reasons: [], criteria: cadenceProtocol, timestamps,
    periodMs: null, halfPeriodsMs: null, halfPeriodDifferenceMs: null,
    idleGapRangeMs: null, diagnosticBandMs: null
  };
  if (input?.version !== cadenceProtocol.version) {
    result.reasons.push(input?.version == null ? 'missing-calibration' : 'unknown-calibration-version');
    return result;
  }
  if (!timestamps || timestamps.length !== cadenceProtocol.timestampCount || !timestamps.every(finite) ||
    !timestamps.every((time, index) => index === 0 || time > timestamps[index - 1])) {
    result.reasons.push('expected-121-strictly-increasing-finite-timestamps');
    return result;
  }
  // These times originate in the blank document, not in the application's time origin.
  const period = (timestamps[120] - timestamps[0]) / 120;
  const halves = [(timestamps[60] - timestamps[0]) / 60, (timestamps[120] - timestamps[60]) / 60];
  const gaps = timestamps.slice(1).map((time, index) => time - timestamps[index]);
  result.periodMs = period;
  result.halfPeriodsMs = halves;
  result.halfPeriodDifferenceMs = Math.abs(halves[1] - halves[0]);
  result.idleGapRangeMs = { min: Math.min(...gaps), max: Math.max(...gaps) };
  if (period < cadenceProtocol.periodMinMs - roundoff || period > cadenceProtocol.periodMaxMs + roundoff)
    result.reasons.push('outside-declared-60hz-period-range');
  if (gaps.some(gap => gap < period * cadenceProtocol.idleGapMinPeriods - roundoff || gap > period * cadenceProtocol.idleGapMaxPeriods + roundoff))
    result.reasons.push('idle-gap-outside-single-period-envelope');
  if (result.halfPeriodDifferenceMs > cadenceProtocol.halfPeriodDifferenceMaxMs + roundoff)
    result.reasons.push('idle-period-not-stable-between-halves');
  result.status = result.reasons.length ? 'unstable' : 'stable';
  if (result.status === 'stable') result.diagnosticBandMs = {
    lower: 2 * period - cadenceProtocol.diagnosticHalfBandMs,
    center: 2 * period,
    upper: 2 * period + cadenceProtocol.diagnosticHalfBandMs
  };
  return result;
}

/** A usable declared-60-Hz baseline is an eligibility requirement, never a replacement raw budget. */
function assessFramePacingBaseline(sample, calibration) {
  const input = sample.idleCalibration;
  const reasons = [];
  if (sample.measurementProtocol !== measurementProtocolVersion) reasons.push('missing-or-unknown-measurement-protocol');
  if (input?.document !== 'blank-before-app' || input?.clock !== 'raf-before-navigation') reasons.push('unknown-baseline-document-or-clock');
  if (input?.visibilityState !== 'visible' || input?.visibleThroughout !== true) reasons.push('baseline-not-confirmed-visible-throughout');
  if (calibration.status !== 'stable') reasons.push(`calibration-${calibration.status}`);
  const times = calibration.timestamps;
  const firstGaps = times?.length >= 12 && times.slice(0, 12).every(finite)
    ? times.slice(1, 12).map((time, index) => time - times[index]) : [];
  const recordedBudget = percentile(firstGaps, 0.5);
  if (!finite(sample.budget) || !finite(recordedBudget) || Math.abs(sample.budget - recordedBudget) > roundoff)
    reasons.push('raw-budget-does-not-match-first-eleven-idle-gaps');
  return { requiredProtocol: measurementProtocolVersion, recordedProtocol: sample.measurementProtocol ?? null,
    usable: reasons.length === 0, reasons, recordedFirstElevenMedianMs: recordedBudget };
}

/** Only a full interval within a phase receives a cadence label; clipped edges are not frames. */
function diagnoseCadenceGap(duration, location, calibration) {
  const available = calibration.status === 'stable';
  const band = calibration.diagnosticBandMs;
  return {
    classification: location === 'outside' ? 'outside-phase' : location === 'boundary' ? 'phase-boundary-unclassified'
      : location === 'unknown' || !available ? 'indeterminate'
      : duration < band.lower - roundoff ? 'below-two-period-band'
      : duration > band.upper + roundoff ? 'above-two-period-band' : 'two-period-borderline',
    periods: available ? duration / calibration.periodMs : null,
    offsetFromTwoPeriodsMs: available ? duration - 2 * calibration.periodMs : null
  };
}

function summarizeCadencePhase(phase, calibration) {
  const gaps = phase.gaps.filter(gap => gap.location !== 'outside' && gap.location !== 'unknown');
  return {
    status: calibration.status === 'stable' && phase.status === 'complete' ? 'complete' : 'indeterminate',
    internalCounts: Object.fromEntries(['below-two-period-band', 'two-period-borderline', 'above-two-period-band', 'indeterminate']
      .map(label => [label, gaps.filter(gap => gap.cadenceDiagnostic.classification === label).length])),
    boundaryGapCount: phase.boundaryGaps.length,
    // A borderline observation is explicitly not a pass, and no diagnostic supplies a gate.
    borderlineIsPass: false
  };
}
const uniqueDuration = ranges => {
  const sorted = ranges.filter(Boolean).filter(range => range.end > range.start).sort((a, b) => a.start - b.start);
  let total = 0, end = -Infinity;
  for (const range of sorted) { total += Math.max(0, range.end - Math.max(end, range.start)); end = Math.max(end, range.end); }
  return total;
};
const clipped = (left, right) => overlap(left, right) > 0 ? interval(Math.max(left.start, right.start), Math.min(left.end, right.end)) : null;

function analyzePhaseFrames(phase, phaseRange, frameTimes, ordered, budget, longFrames, calibration) {
  const gaps = frameTimes && ordered ? frameTimes.slice(1).map((end, i) => {
    const range = interval(frameTimes[i], end), duration = end - frameTimes[i];
    const internal = Boolean(phaseRange && range.start >= phaseRange.start && range.end <= phaseRange.end);
    const phaseOverlapMs = phaseRange ? overlap(range, phaseRange) : null;
    const phasePortionExceedsTwoBudgets = budget && phaseRange ? phaseOverlapMs > 2 * budget + roundoff : null;
    const location = !phaseRange ? 'unknown' : internal ? phase : phaseOverlapMs > 0 ? 'boundary' : 'outside';
    return {
      start: range.start, end, duration, budgets: budget ? duration / budget : null,
      location,
      phaseOverlapMs, phasePortionExceedsTwoBudgets,
      // Keep existing moving-report consumers compatible.
      ...(phase === 'moving' ? { movingOverlapMs: phaseOverlapMs, movingPortionExceedsTwoBudgets: phasePortionExceedsTwoBudgets } : {}),
      exceedsTwoBudgets: budget ? duration > 2 * budget + roundoff : null,
      cadenceDiagnostic: diagnoseCadenceGap(duration, location, calibration),
      // A script must intersect both the gap and the exact phase; earlier binding
      // does not become reveal work merely because their LoAF spans both.
      scriptOverlaps: phaseOverlapMs > 0 ? longFrames.flatMap(entry => entry.scripts.flatMap(script => {
        const scriptRange = clipped(interval(script.start, script.end), clipped(range, phaseRange));
        return scriptRange ? [{ frameIndex: entry.index, function: script.function, url: script.url,
          overlapMs: scriptRange.end - scriptRange.start, scriptStart: script.start, scriptEnd: script.end }] : [];
      })) : []
    };
  }) : [];
  const internal = gaps.filter(gap => gap.location === phase);
  const coverage = {
    beforeStart: Boolean(phaseRange && frameTimes?.length && ordered && frameTimes[0] <= phaseRange.start),
    afterEnd: Boolean(phaseRange && frameTimes?.length && ordered && frameTimes.at(-1) >= phaseRange.end)
  };
  // A single gap spanning the whole phase can prove a stall even without an
  // internal frame pair. Incomplete boundary coverage must never produce a pass.
  const complete = Boolean(phaseRange && phaseRange.end > phaseRange.start && frameTimes?.length >= 2 && ordered && budget && coverage.beforeStart && coverage.afterEnd);
  return {
    status: complete ? 'complete' : 'incomplete', interval: phaseRange, coverage,
    thresholdMs: budget ? 2 * budget : null, statistics: statistics(internal.map(gap => gap.duration)),
    violations: internal.filter(gap => gap.exceedsTwoBudgets),
    boundaryGaps: gaps.filter(gap => gap.location === 'boundary'),
    boundaryViolations: gaps.filter(gap => gap.location === 'boundary' && gap.phasePortionExceedsTwoBudgets),
    gaps
  };
}

/** All timestamps use the document's performance.now() clock; RAF times remain RAF times. */
export function analyzeSample(sample, index = 0) {
  const t = sample.timings ?? {};
  const warnings = [];
  const moving = finite(t.firstMotion) && finite(t.motionEnded) && t.firstMotion > 0
    ? interval(t.firstMotion, t.motionEnded) : null;
  const reveal = finite(t.revealStarted) && finite(t.revealEnded) && t.revealStarted > 0
    ? interval(t.revealStarted, t.revealEnded) : null;
  const latencyWindow = interval(t.started, t.firstMotion);
  const clickThroughMotion = moving ? interval(t.started, moving.end) : null;
  const holdWindow = interval(t.holdStarted, t.held);
  const betweenPhases = moving && reveal ? interval(moving.end, reveal.start) : null;
  if (!moving) warnings.push('Missing/invalid firstMotion or motionEnded: held is not substituted for motionEnded.');
  if (!reveal) warnings.push('Missing/invalid revealStarted or revealEnded: committed/revealed are not substituted for the reveal interval.');
  if (!holdWindow) warnings.push('Missing/invalid holdStarted: the hold hook cannot be isolated.');
  const budget = finite(sample.budget) && sample.budget > 0 ? sample.budget : null;
  const sourceBudget = finite(sample.sourceBudget) && sample.sourceBudget > 0 ? sample.sourceBudget : null;
  const calibration = analyzeIdleCadence(sample.idleCalibration);
  const framePacingBaseline = assessFramePacingBaseline(sample, calibration);
  const frameTimes = Array.isArray(sample.frames) && sample.frames.every(finite) ? sample.frames : null;
  const ordered = frameTimes?.every((time, i) => i === 0 || time >= frameTimes[i - 1]);
  if (!frameTimes) warnings.push('No absolute RAF timestamps: legacy gaps cannot be located or attributed to scripts.');
  else if (!ordered) warnings.push('RAF timestamps are not monotonic.');
  if (!budget) warnings.push('Missing/invalid measured RAF budget.');

  const longFrames = (sample.longFrames ?? []).map((entry, frameIndex) => {
    const range = interval(entry.startTime, entry.startTime + entry.duration);
    const scripts = (entry.scripts ?? []).map(script => {
      const scriptRange = interval(script.startTime, script.startTime + script.duration);
      const movingOverlap = overlap(scriptRange, moving);
      return {
        start: scriptRange?.start ?? null, end: scriptRange?.end ?? null,
        duration: scriptRange ? scriptRange.end - scriptRange.start : null,
        function: script.sourceFunctionName ?? '', url: script.sourceURL ?? '', invoker: script.invoker ?? '',
        beforeMotionMs: overlap(scriptRange, latencyWindow), movingMs: moving ? movingOverlap : null,
        revealMs: reveal ? overlap(scriptRange, reveal) : null,
        betweenPhasesMs: betweenPhases ? overlap(scriptRange, betweenPhases) : null,
        holdMs: holdWindow ? overlap(scriptRange, holdWindow) : null,
        afterMotionMs: moving && scriptRange ? Math.max(0, scriptRange.end - Math.max(scriptRange.start, moving.end)) : null,
        // This aggregate has no internal timestamp. Do not prorate a straddling script's layout work.
        forcedLayoutMs: script.forcedStyleAndLayoutDuration ?? null,
        forcedLayoutWhollyInMoving: Boolean(moving && scriptRange && scriptRange.start >= moving.start && scriptRange.end <= moving.end),
        forcedLayoutWhollyInReveal: Boolean(reveal && scriptRange && scriptRange.start >= reveal.start && scriptRange.end <= reveal.end)
      };
    });
    const movingScriptRanges = scripts.map(script => clipped(interval(script.start, script.end), moving));
    return {
      index: frameIndex, start: range?.start ?? null, end: range?.end ?? null,
      duration: range ? range.end - range.start : null,
      beforeMotionOverlapMs: overlap(range, latencyWindow), movingOverlapMs: moving ? overlap(range, moving) : null,
      revealOverlapMs: reveal ? overlap(range, reveal) : null,
      betweenPhasesOverlapMs: betweenPhases ? overlap(range, betweenPhases) : null,
      holdOverlapMs: holdWindow ? overlap(range, holdWindow) : null,
      movingScriptCoverageMs: moving ? uniqueDuration(movingScriptRanges) : null,
      revealScriptCoverageMs: reveal ? uniqueDuration(scripts.map(script => clipped(interval(script.start, script.end), reveal))) : null,
      // An overlapping LoAF is evidence of an interval, not a claim that its entire duration caused stutter.
      scripts
    };
  });

  const movingRAF = analyzePhaseFrames('moving', moving, frameTimes, ordered, budget, longFrames, calibration);
  const revealRAF = analyzePhaseFrames('reveal', reveal, frameTimes, ordered, budget, longFrames, calibration);
  for (const [name, report] of [['moving', movingRAF], ['reveal', revealRAF]]) {
    if (report.interval && report.status !== 'complete') warnings.push(`Incomplete RAF coverage/budget for ${name}: missing intervals cannot pass frame pacing.`);
  }
  const latency = key => finite(t.started) && finite(t[key]) && t[key] >= t.started && t[key] > 0 ? t[key] - t.started : null;
  const gpuCalls = Array.isArray(sample.gpuCalls) ? sample.gpuCalls : null;
  const observedDomChange = finite(sample.observedDomChange) && sample.observedDomChange > 0 ? sample.observedDomChange : null;
  const validationErrors = Array.isArray(sample.validationErrors) ? sample.validationErrors.map(String) : null;
  if (validationErrors === null) warnings.push('No per-sample validation record: route-temperature and runtime checks cannot be certified.');
  if (observedDomChange === null) warnings.push('Missing/nonpositive observed DOM change: do not omit this sample from latency acceptance.');
  return {
    index, timings: t, firstMotionMs: latency('firstMotion'), firstSubmitMs: latency('firstSubmitted'), observedDomChangeMs: observedDomChange,
    motionDurationMs: moving ? moving.end - moving.start : null,
    revealDurationMs: reveal ? reveal.end - reveal.start : null,
    betweenPhasesDurationMs: betweenPhases ? betweenPhases.end - betweenPhases.start : null,
    measuredBudgetMs: budget, sourceBudgetMs: sourceBudget, sourceBudgetRatio: sourceBudget && budget ? sourceBudget / budget : null, warnings,
    framePacingBaseline,
    cadenceDiagnostic: {
      version: cadenceProtocol.version, acceptanceGate: false, calibration,
      moving: summarizeCadencePhase(movingRAF, calibration), reveal: summarizeCadencePhase(revealRAF, calibration)
    },
    movingRAF: {
      ...movingRAF,
      // Do not silently discard long legacy gaps just because precise timestamps were not recorded.
      unlocatedLegacyGaps: !frameTimes && Array.isArray(sample.gaps)
        ? sample.gaps.filter(value => finite(value) && budget && value > 2 * budget + roundoff) : []
    },
    revealRAF,
    gpuCreatesClickThroughMotion: clickThroughMotion && gpuCalls ? gpuCalls.filter(call => containsTime(clickThroughMotion, call.time)) : null,
    gpuCreatesDuringReveal: reveal && gpuCalls ? gpuCalls.filter(call => containsTime(reveal, call.time)) : null,
    validationErrors,
    longFrames,
    movingScriptCoverageMs: moving ? uniqueDuration(longFrames.flatMap(entry => entry.scripts.map(script => clipped(interval(script.start, script.end), moving)))) : null,
    revealScriptCoverageMs: reveal ? uniqueDuration(longFrames.flatMap(entry => entry.scripts.map(script => clipped(interval(script.start, script.end), reveal)))) : null
  };
}

export function analyzeReport(input, { source = '', profiled = false } = {}) {
  profiled ||= input.profiled === true;
  const samples = Array.isArray(input) ? input : input.results;
  if (!Array.isArray(samples)) throw new Error(`${source}: expected samples[] or a measurements report with results[].`);
  const results = samples.map(analyzeSample);
  const expected = Number.isInteger(input.samples) ? input.samples : null;
  const values = key => results.map(result => result[key]).filter(finite);
  const motion = statistics(values('firstMotionMs')), submit = statistics(values('firstSubmitMs'));
  const dom = statistics(values('observedDomChangeMs'));
  const completeClockLatency = results.length > 0 && motion.count === results.length && submit.count === results.length;
  const completeDomLatency = results.length > 0 && dom.count === results.length;
  const phaseComplete = key => results.length > 0 && results.every(result => result[key].status === 'complete');
  const phaseGate = key => {
    // A recorded violation is conclusive even if a later boundary is missing.
    // Missing data can prevent a pass, never erase an already observed failure.
    if (results.some(result => result[key].violations.length || result[key].boundaryViolations.length)) return false;
    return phaseComplete(key) ? true : null;
  };
  const fullRun = !profiled && expected !== null && expected === results.length && expected >= 20;
  const completeList = key => results.length > 0 && results.every(result => result[key] !== null);
  const emptyListGate = key => results.some(result => result[key]?.length > 0)
    ? false : completeList(key) ? true : null;
  const validationGate = emptyListGate('validationErrors');
  const usableBaseline = results.length > 0 && results.every(result => result.framePacingBaseline.usable);
  return {
    source, view: input.view ?? null, endpoint: input.endpoint ?? null, temperature: input.temperature ?? null,
    viewport: input.viewport ?? null, browser: input.userAgent ?? input.browser ?? null, machine: input.machine ?? null,
    expectedSamples: expected, actualSamples: results.length, profiled,
    eligibleForLatencyAcceptance: fullRun && completeClockLatency && completeDomLatency && validationGate === true,
    eligibleForFramePacingAcceptance: fullRun && phaseComplete('movingRAF') && phaseComplete('revealRAF') && validationGate === true && usableBaseline,
    eligibleForResourceAcceptance: fullRun && completeList('gpuCreatesClickThroughMotion') && completeList('gpuCreatesDuringReveal') && validationGate === true,
    latency: { firstMotion: motion, firstSubmit: submit, observedDomChange: dom },
    cadence: { idleBudgetMs: statistics(values('measuredBudgetMs')), sourceBudgetMs: statistics(values('sourceBudgetMs')), sourceToIdleRatio: statistics(values('sourceBudgetRatio')) },
    framePacingBaseline: { requiredProtocol: measurementProtocolVersion,
      usableSamples: results.filter(result => result.framePacingBaseline.usable).length, usableForAllSamples: usableBaseline },
    cadenceDiagnostic: {
      version: cadenceProtocol.version, acceptanceGate: false,
      calibrationCounts: Object.fromEntries(['stable', 'unstable', 'indeterminate'].map(status =>
        [status, results.filter(result => result.cadenceDiagnostic.calibration.status === status).length])),
      periodMs: statistics(results.filter(result => result.cadenceDiagnostic.calibration.status === 'stable')
        .map(result => result.cadenceDiagnostic.calibration.periodMs))
    },
    gates: {
      firstMotionP95Below100ms: completeClockLatency ? motion.p95 < 100 : null,
      firstSubmitP95Below100ms: completeClockLatency ? submit.p95 < 100 : null,
      observedDomChangeP95Below100ms: completeDomLatency ? dom.p95 < 100 : null,
      noMovingRafGapAboveTwoBudgets: phaseGate('movingRAF'),
      noRevealRafGapAboveTwoBudgets: phaseGate('revealRAF'),
      noGpuCreatesClickThroughMotion: emptyListGate('gpuCreatesClickThroughMotion'),
      noGpuCreatesDuringReveal: emptyListGate('gpuCreatesDuringReveal'),
      noSampleValidationErrors: validationGate
    },
    results
  };
}

async function artifactFiles(path) {
  if ((await stat(path)).isFile()) return [path];
  const entries = await readdir(path, { withFileTypes: true });
  // measurements embeds the same results as samples; never double count both.
  const selected = ['measurements.json', 'samples.json'].find(name => entries.some(entry => entry.isFile() && entry.name === name));
  const nested = await Promise.all(entries.filter(entry => entry.isDirectory()).map(entry => artifactFiles(join(path, entry.name))));
  return [...(selected ? [join(path, selected)] : []), ...nested.flat()].sort();
}

async function selfTest() {
  const { strict: assert } = await import('node:assert');
  const sample = {
    timings: { started: 1, firstMotion: 20, firstSubmitted: 22, motionEnded: 100, holdStarted: 116, held: 700 },
    observedDomChange: 24, budget: 16, frames: [16, 32, 48, 96, 112, 128], gpuCalls: [], validationErrors: [],
    longFrames: [{ startTime: 90, duration: 600, scripts: [
      { startTime: 116, duration: 550, sourceFunctionName: 'hold', forcedStyleAndLayoutDuration: 80 },
      { startTime: 90, duration: 50, sourceFunctionName: 'straddling', forcedStyleAndLayoutDuration: 10 }
    ] }]
  };
  const result = analyzeSample(sample);
  assert.equal(result.movingRAF.violations.length, 1);
  assert.equal(result.movingRAF.violations[0].duration, 48);
  assert.equal(result.movingRAF.violations[0].scriptOverlaps.length, 1);
  assert.equal(result.movingRAF.violations[0].scriptOverlaps[0].overlapMs, 6);
  assert.equal(result.movingRAF.boundaryGaps.length, 2);
  assert.equal(result.longFrames[0].movingOverlapMs, 10);
  assert.equal(result.longFrames[0].scripts[0].movingMs, 0);
  assert.equal(result.longFrames[0].scripts[0].holdMs, 550);
  assert.equal(result.longFrames[0].scripts[1].movingMs, 10);
  assert.equal(result.longFrames[0].scripts[1].forcedLayoutWhollyInMoving, false);
  assert.equal(result.movingScriptCoverageMs, 10);
  const legacy = analyzeSample({ ...sample, frames: undefined, gaps: [16, 250], timings: { ...sample.timings, motionEnded: undefined } });
  assert.equal(legacy.movingRAF.status, 'incomplete');
  assert.deepEqual(legacy.movingRAF.unlocatedLegacyGaps, [250]);
  assert.equal(legacy.longFrames[0].movingScriptCoverageMs, null);
  assert.equal(analyzeSample({ ...sample, frames: [32, 64, 96] }).movingRAF.violations.length, 0);
  const longBoundary = analyzeSample({ ...sample, frames: [16, 64, 80, 112] });
  assert.equal(longBoundary.movingRAF.violations.length, 0);
  assert.equal(longBoundary.movingRAF.boundaryViolations.length, 1);
  assert.equal(longBoundary.movingRAF.boundaryViolations[0].movingOverlapMs, 44);
  assert.equal(analyzeReport({ samples: 1, results: [{ ...sample, frames: [16, 64, 80, 112] }] }).gates.noMovingRafGapAboveTwoBudgets, false);
  assert.equal(analyzeReport({ samples: 20, results: Array(20).fill(sample) }).eligibleForLatencyAcceptance, true);
  assert.equal(analyzeReport({ samples: 20, results: [sample] }).eligibleForLatencyAcceptance, false);
  assert.equal(analyzeReport({ samples: 20, results: Array(20).fill(sample) }, { profiled: true }).eligibleForLatencyAcceptance, false);
  assert.equal(analyzeReport({ samples: 20, results: Array(20).fill(sample), profiled: true }).eligibleForLatencyAcceptance, false);
  const revealSample = {
    ...sample,
    timings: { ...sample.timings, revealStarted: 720, revealEnded: 1000, revealed: 1300 },
    sourceBudget: 32,
    frames: [16, 32, 48, 64, 80, 96, 112, 128, 688, 704, 720, 736, 752, 816, 832, 848, 864, 880, 896, 912, 928, 944, 960, 976, 992, 1008],
    longFrames: [{ startTime: 650, duration: 350, scripts: [
      { startTime: 650, duration: 65, sourceFunctionName: 'binding' },
      { startTime: 710, duration: 20, sourceFunctionName: 'straddling', forcedStyleAndLayoutDuration: 10 },
      { startTime: 770, duration: 30, sourceFunctionName: 'reveal', forcedStyleAndLayoutDuration: 5 }
    ] }]
  };
  const revealResult = analyzeSample(revealSample);
  assert.equal(revealResult.revealDurationMs, 280); // Do not include post-reveal adoption until revealed=1300.
  assert.equal(revealResult.betweenPhasesDurationMs, 620);
  assert.equal(revealResult.revealRAF.status, 'complete');
  assert.equal(revealResult.revealRAF.thresholdMs, 32); // Source cadence=32 must not relax the idle 16 ms budget.
  assert.equal(revealResult.sourceBudgetRatio, 2);
  assert.equal(revealResult.revealRAF.violations.length, 1);
  assert.equal(revealResult.revealRAF.violations[0].duration, 64);
  assert.deepEqual(revealResult.revealRAF.violations[0].scriptOverlaps.map(script => [script.function, script.overlapMs]), [['reveal', 30]]);
  assert.equal(revealResult.longFrames[0].scripts[0].revealMs, 0);
  assert.equal(revealResult.longFrames[0].scripts[1].revealMs, 10);
  assert.equal(revealResult.longFrames[0].scripts[1].forcedLayoutWhollyInReveal, false);
  assert.equal(revealResult.longFrames[0].scripts[2].forcedLayoutWhollyInReveal, true);
  assert.equal(revealResult.revealScriptCoverageMs, 40);
  const fullRevealReport = analyzeReport({ samples: 20, results: Array(20).fill(revealSample) });
  assert.equal(fullRevealReport.eligibleForFramePacingAcceptance, false); // Legacy samples lack the v2 baseline evidence.
  assert.equal(fullRevealReport.gates.noMovingRafGapAboveTwoBudgets, true);
  assert.equal(fullRevealReport.gates.noRevealRafGapAboveTwoBudgets, false);
  const smoothReveal = { ...revealSample, frames: [...revealSample.frames, 768, 784, 800].sort((a, b) => a - b) };
  assert.equal(analyzeReport({ samples: 1, results: [smoothReveal] }).gates.noRevealRafGapAboveTwoBudgets, true);
  const singleRevealGap = analyzeSample({ ...revealSample, frames: [16, 112, 704, 1008] });
  assert.equal(singleRevealGap.revealRAF.status, 'complete');
  assert.equal(singleRevealGap.revealRAF.boundaryViolations[0].phaseOverlapMs, 280);
  const clippedReveal = analyzeReport({ samples: 1, results: [{ ...smoothReveal, frames: smoothReveal.frames.filter(time => time < 1000) }] });
  assert.equal(clippedReveal.gates.noRevealRafGapAboveTwoBudgets, null);
  assert.equal(clippedReveal.results[0].revealRAF.coverage.afterEnd, false);
  assert.equal(analyzeReport({ samples: 1, results: [{ ...revealSample, frames: revealSample.frames.filter(time => time < 1000) }] }).gates.noRevealRafGapAboveTwoBudgets, false);
  assert.equal(analyzeReport({ samples: 1, results: [sample] }).gates.noRevealRafGapAboveTwoBudgets, null);
  assert.equal(analyzeReport({ samples: 20, results: Array(20).fill(revealSample), profiled: true }).eligibleForFramePacingAcceptance, false);
  const accepted = analyzeReport({ samples: 20, results: Array(20).fill(smoothReveal), viewport: { width: 1440, height: 1000 } });
  assert.equal(accepted.eligibleForLatencyAcceptance, true);
  assert.equal(accepted.eligibleForResourceAcceptance, true);
  assert.equal(accepted.gates.observedDomChangeP95Below100ms, true);
  assert.equal(accepted.gates.noSampleValidationErrors, true);
  assert.equal(accepted.gates.noGpuCreatesDuringReveal, true);
  assert.deepEqual(accepted.viewport, { width: 1440, height: 1000 });
  const slowDom = analyzeReport({ samples: 20, results: [...Array(18).fill(smoothReveal),
    { ...smoothReveal, observedDomChange: 100 }, { ...smoothReveal, observedDomChange: 140 }] });
  assert.equal(slowDom.latency.observedDomChange.p95, 100);
  assert.equal(slowDom.gates.observedDomChangeP95Below100ms, false);
  const missingDom = analyzeReport({ samples: 20, results: [...Array(19).fill(smoothReveal), { ...smoothReveal, observedDomChange: 0 }] });
  assert.equal(missingDom.actualSamples, 20);
  assert.equal(missingDom.eligibleForLatencyAcceptance, false);
  assert.equal(missingDom.gates.observedDomChangeP95Below100ms, null);
  const rejected = analyzeReport({ samples: 20, results: [...Array(19).fill(smoothReveal),
    { ...smoothReveal, validationErrors: ['Expected cold route data, observed preloaded data.'] }] });
  assert.equal(rejected.actualSamples, 20);
  assert.equal(rejected.latency.firstMotion.count, 20);
  assert.equal(rejected.gates.noSampleValidationErrors, false);
  assert.equal(rejected.eligibleForLatencyAcceptance, false);
  assert.equal(rejected.eligibleForFramePacingAcceptance, false);
  assert.equal(rejected.eligibleForResourceAcceptance, false);
  const legacyValidation = analyzeReport({ samples: 20, results: Array(20).fill({ ...smoothReveal, validationErrors: undefined }) });
  assert.equal(legacyValidation.gates.noSampleValidationErrors, null);
  assert.equal(legacyValidation.eligibleForLatencyAcceptance, false);
  const allocated = { ...smoothReveal, gpuCalls: [
    { method: 'createTexture', time: 719, phase: 'revealing' }, // The exact timestamp wins over a phase label.
    { method: 'createTexture', time: 720 }, { method: 'createBuffer', time: 1000 },
    { method: 'createTexture', time: 1001 }
  ] };
  assert.deepEqual(analyzeSample(allocated).gpuCreatesDuringReveal.map(call => call.time), [720, 1000]);
  const mixedCoverage = analyzeReport({ samples: 2, results: [allocated, { ...smoothReveal, gpuCalls: undefined }] });
  assert.equal(mixedCoverage.gates.noGpuCreatesDuringReveal, false);
  assert.equal(mixedCoverage.gates.noGpuCreatesClickThroughMotion, null);
  assert.equal(analyzeReport({ samples: 1, results: [sample] }).gates.noGpuCreatesDuringReveal, null);

  // Versioned diagnostics never modify the original raw budget, gates or acceptance eligibility.
  const idleCalibration = { version: 'cadence-diagnostic-v1',
    timestamps: Array.from({ length: 121 }, (_, index) => Math.floor((1000 + index * 1000 / 60) * 10) / 10) };
  const calibrated = analyzeIdleCadence(idleCalibration);
  assert.equal(calibrated.status, 'stable');
  assert.equal(calibrated.periodMs, 1000 / 60);
  assert.deepEqual(calibrated.timestamps, idleCalibration.timestamps);
  assert.equal(analyzeIdleCadence(undefined).status, 'indeterminate');
  assert.equal(analyzeIdleCadence({ ...idleCalibration, version: 'cadence-diagnostic-v2' }).status, 'indeterminate');
  assert.equal(analyzeIdleCadence({ ...idleCalibration, timestamps: idleCalibration.timestamps.slice(0, 120) }).status, 'indeterminate');
  const invalidTimes = [...idleCalibration.timestamps]; invalidTimes[60] = invalidTimes[59];
  assert.equal(analyzeIdleCadence({ ...idleCalibration, timestamps: invalidTimes }).status, 'indeterminate');
  invalidTimes[60] = Number.NaN;
  assert.equal(analyzeIdleCadence({ ...idleCalibration, timestamps: invalidTimes }).status, 'indeterminate');
  assert.equal(analyzeIdleCadence({ ...idleCalibration, timestamps: idleCalibration.timestamps.map(time => time * 2) }).status, 'unstable');
  const skipped = [...idleCalibration.timestamps]; skipped[30] += 8;
  assert.deepEqual(analyzeIdleCadence({ ...idleCalibration, timestamps: skipped }).reasons, ['idle-gap-outside-single-period-envelope']);
  const drifting = Array.from({ length: 121 }, (_, index) => index <= 60 ? index * 16.6 : 60 * 16.6 + (index - 60) * 16.7);
  assert.deepEqual(analyzeIdleCadence({ ...idleCalibration, timestamps: drifting }).reasons, ['idle-period-not-stable-between-halves']);
  const gapSample = { ...smoothReveal, budget: 16.6, idleCalibration,
    timings: { ...smoothReveal.timings, firstMotion: 20, motionEnded: 189 },
    frames: [0, 20, 53.3, 86.8, 136.8, 176.8, 192, 704, 720, 736, 752, 768, 784, 800,
      816, 832, 848, 864, 880, 896, 912, 928, 944, 960, 976, 992, 1008] };
  const diagnosed = analyzeSample(gapSample);
  assert.equal(diagnosed.movingRAF.violations.length, 4); // 33.3, 33.5, 50 and 40 still fail the strict 33.2 gate.
  assert.deepEqual(diagnosed.movingRAF.violations.map(gap => gap.cadenceDiagnostic.classification),
    ['two-period-borderline', 'two-period-borderline', 'above-two-period-band', 'above-two-period-band']);
  assert.equal(diagnosed.cadenceDiagnostic.moving.borderlineIsPass, false);
  assert.equal(diagnosed.movingRAF.boundaryGaps.at(-1).cadenceDiagnostic.classification, 'phase-boundary-unclassified');
  assert.equal(diagnosed.cadenceDiagnostic.moving.internalCounts['two-period-borderline'], 2);
  assert.equal(analyzeSample({ ...gapSample, idleCalibration: undefined }).movingRAF.violations[0].cadenceDiagnostic.classification, 'indeterminate');
  for (const budget of [16.6, 16.7]) {
    const calibratedReport = analyzeReport({ samples: 20, results: Array(20).fill({ ...gapSample, budget }) });
    const legacyReport = analyzeReport({ samples: 20, results: Array(20).fill({ ...gapSample, budget, idleCalibration: undefined }) });
    assert.deepEqual(calibratedReport.gates, legacyReport.gates);
    assert.equal(calibratedReport.eligibleForFramePacingAcceptance, legacyReport.eligibleForFramePacingAcceptance);
    assert.equal(calibratedReport.cadenceDiagnostic.acceptanceGate, false);
    assert.deepEqual(calibratedReport.cadenceDiagnostic.calibrationCounts, { stable: 20, unstable: 0, indeterminate: 0 });
  }
  // Even at the slowest permitted reference, a real 50 ms interval cannot enter the borderline band.
  const slowestValid = analyzeIdleCadence({ ...idleCalibration, timestamps: Array.from({ length: 121 }, (_, index) => index * 17.5) });
  assert.equal(slowestValid.status, 'stable');
  assert.equal(slowestValid.diagnosticBandMs.upper, 35.5);
  assert.equal(diagnoseCadenceGap(50, 'reveal', slowestValid).classification, 'above-two-period-band');
  assert.equal(summarizeCadencePhase({ ...diagnosed.movingRAF, status: 'incomplete' }, calibrated).status, 'indeterminate');

  // Protocol v2 tightens eligibility only; raw thresholds, values and historical gates stay intact.
  const visibleCalibration = { ...idleCalibration, document: 'blank-before-app', clock: 'raf-before-navigation',
    visibilityState: 'visible', visibleThroughout: true };
  const calibratedBudget = percentile(idleCalibration.timestamps.slice(1, 12)
    .map((time, index) => time - idleCalibration.timestamps[index]), 0.5);
  const v2Sample = { ...smoothReveal, measurementProtocol: measurementProtocolVersion,
    budget: calibratedBudget, idleCalibration: visibleCalibration };
  const full = value => analyzeReport({ samples: 20, results: Array(20).fill(value) });
  const eligible = full(v2Sample);
  assert.equal(eligible.eligibleForFramePacingAcceptance, true);
  assert.deepEqual(eligible.framePacingBaseline, {
    requiredProtocol: measurementProtocolVersion, usableSamples: 20, usableForAllSamples: true });
  assert.equal(eligible.gates.noMovingRafGapAboveTwoBudgets, true);
  assert.equal(eligible.gates.noRevealRafGapAboveTwoBudgets, true);
  assert.equal(analyzeReport({ samples: 20, profiled: true, results: Array(20).fill(v2Sample) }).eligibleForFramePacingAcceptance, false);
  assert.equal(analyzeReport({ samples: 20, results: Array(19).fill(v2Sample) }).eligibleForFramePacingAcceptance, false);
  assert.equal(full({ ...v2Sample, frames: v2Sample.frames.filter(time => time < 1000) }).eligibleForFramePacingAcceptance, false);
  const unversioned = full({ ...v2Sample, measurementProtocol: undefined });
  assert.equal(unversioned.eligibleForFramePacingAcceptance, false);
  assert.deepEqual(unversioned.gates, eligible.gates);
  assert.equal(full({ ...v2Sample, measurementProtocol: 'staged-performance-v3' }).eligibleForFramePacingAcceptance, false);
  assert.equal(full({ ...v2Sample, idleCalibration: undefined }).eligibleForFramePacingAcceptance, false);
  for (const changed of [
    { visibilityState: 'hidden' }, { visibleThroughout: false }, { visibleThroughout: undefined },
    { document: 'application' }, { clock: 'unknown' }, { timestamps: skipped },
    { timestamps: idleCalibration.timestamps.slice(1) }, { version: 'unknown' }
  ]) {
    const unusable = full({ ...v2Sample, idleCalibration: { ...visibleCalibration, ...changed } });
    assert.equal(unusable.eligibleForFramePacingAcceptance, false);
    assert.deepEqual(unusable.gates, eligible.gates);
  }
  assert.equal(full({ ...v2Sample, budget: calibratedBudget + 0.1 }).eligibleForFramePacingAcceptance, false);
  const mixedBaseline = analyzeReport({ samples: 20, results: [...Array(19).fill(v2Sample),
    { ...v2Sample, idleCalibration: { ...visibleCalibration, visibleThroughout: false } }] });
  assert.equal(mixedBaseline.actualSamples, 20);
  assert.equal(mixedBaseline.framePacingBaseline.usableSamples, 19);
  assert.equal(mixedBaseline.eligibleForFramePacingAcceptance, false);
  for (const gap of [50, 133]) {
    const stalled = { ...v2Sample, timings: { ...v2Sample.timings, firstMotion: 20, motionEnded: 189 },
      frames: [0, 20, 20 + gap, 189, ...v2Sample.frames.filter(time => time >= 192)] };
    const report = full(stalled);
    assert.equal(report.eligibleForFramePacingAcceptance, true); // Valid evidence may establish a failure.
    assert.equal(report.gates.noMovingRafGapAboveTwoBudgets, false);
    assert.equal(report.results[0].movingRAF.violations[0].duration, gap);
  }
  // A 30-Hz idle budget can numerically admit 50 ms in the legacy gate. It is not
  // eligible evidence for this declared-60-Hz acceptance, even when all raw gates pass.
  const slowCalibration = { ...visibleCalibration, timestamps: Array.from({ length: 121 }, (_, index) => index * 1000 / 30) };
  const slowBudget = percentile(slowCalibration.timestamps.slice(1, 12).map((time, index) => time - slowCalibration.timestamps[index]), 0.5);
  const fiftyMsSample = { ...v2Sample, budget: slowBudget, idleCalibration: slowCalibration,
    frames: [0, 20, 70, 100, 704, 720, 770, 800, 850, 900, 950, 1000, 1008] };
  const slowBaselineReport = full(fiftyMsSample);
  assert.equal(slowBaselineReport.gates.noMovingRafGapAboveTwoBudgets, true);
  assert.equal(slowBaselineReport.gates.noRevealRafGapAboveTwoBudgets, true);
  assert.equal(slowBaselineReport.eligibleForFramePacingAcceptance, false);
  assert.equal(slowBaselineReport.framePacingBaseline.usableSamples, 0);
  process.stdout.write('Staged-performance attribution checks passed.\n');
}

async function main(args) {
  if (args[0] === '--self-test') return selfTest();
  const input = args[0];
  if (!input || (args.length > 1 && (args.length !== 3 || args[1] !== '--output'))) {
    throw new Error('Usage: node scripts/analyze-staged-performance.mjs <artifact-directory-or-json> [--output report.json]');
  }
  const paths = await artifactFiles(resolve(input));
  if (!paths.length) throw new Error('No measurements.json or samples.json found.');
  const reports = [];
  for (const path of paths) {
    const siblings = await readdir(dirname(path));
    reports.push(analyzeReport(JSON.parse(await readFile(path, 'utf8')), {
      source: path, profiled: siblings.some(name => /^cpu-\d+\.json$/.test(name))
    }));
  }
  const output = JSON.stringify({
    measurementNotes: [
      'First submit measures CPU submission, not GPU completion or display presentation.',
      'RAF gaps measure callback availability. Long Animation Frame scripts are interval overlaps, not proof of exclusive causality.',
      'Gaps fully inside [firstMotion,motionEnded] and the clipped moving portion of boundary gaps are gated separately against two measured budgets.',
      'Reveal uses only [revealStarted,revealEnded]; earlier binding and later adoption are outside its frame-pacing gate.',
      'Both phase gates use budget, the idle cadence before app startup. sourceBudget is diagnostic and cannot relax the threshold.',
      'cadence-diagnostic-v1 is additional interpretation only: 121 blank-document timestamps, stable declared 60 Hz calibration and a fixed +/-0.5 ms band around two periods.',
      'Borderline cadence labels are not passes. Missing, unknown or unstable calibration cannot classify a gap; raw gates and historical outcomes are unchanged.',
      'Frame-pacing acceptance requires staged-performance-v2 evidence: a stable declared-60-Hz calibration visible throughout on the blank document, with budget equal to its original first-eleven-gap median. Missing evidence blocks eligibility, never changes raw gates.',
      'Absolute RAF samples must cover both boundaries of each phase. Missing markers/coverage produce incomplete gates, not passes.',
      'GPU creation gates cover click-through-motion and the exact reveal interval separately; phase labels cannot override timestamps.',
      'DOM observation must exist for every sample. Validation failures and missing validation records cannot establish acceptance.',
      'Nearest-rank percentiles retain every sample. Fewer than 20 or profiled samples cannot establish latency acceptance.'
    ], reports
  }, null, 2);
  if (args[2]) {
    await writeFile(resolve(args[2]), output + '\n');
    process.stdout.write(`Analyzed ${reports.length} report(s), ${reports.reduce((total, report) => total + report.actualSamples, 0)} sample(s): ${resolve(args[2])}\n`);
  } else process.stdout.write(output + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
