# Staged navigation: production measurement protocol

This report accompanies the [source-readiness contract](staged-gpu-readiness.md) and
[implementation plan](../../layout-system-implementation-plan.md). Functional correctness,
GPU resource reuse and input latency are separate gates. A successful resource probe does
not establish smooth animation or a latency percentile.

## Reproduce

Build the packages and public demo once. Stop other builds and browser benchmarks before
measuring; the performance configuration deliberately does not build its own server.

```powershell
npm.cmd run build
npm.cmd run build:demo
npx.cmd playwright test --config playwright.staged-performance.config.ts --reporter=line
node scripts/analyze-staged-performance.mjs .artifacts/staged-performance --output .artifacts/staged-performance-analysis.json
```

The default runs twenty fresh browser contexts for each source (list/carousel) and each
target-route temperature (cold/warm), using installed Chrome on Windows. Run the compact
destination separately with `$env:SPATIAL_PERFORMANCE_ENDPOINT='dock'`. Remove that variable
to measure the overview. `SPATIAL_PERFORMANCE_SAMPLES=1` is a diagnostic run only; it cannot
establish percentile acceptance. `SPATIAL_PERFORMANCE_PROFILE=1` records a CPU profile and
likewise excludes that run from latency acceptance. Traces, video and screenshots are off
during the timing run; visual correctness has a separate production suite.

## What the samples establish

- **Cold** means target route data and route modules were not preloaded. The source geometry
  is already prepared and displayed. This is not a cold browser, driver or operating-system
  cache measurement. Resource entries must show both the detail data and a route module
  beginning after activation.
- **Warm** uses the application's real hover preloading. Detail data and route modules must
  have finished before activation. A fresh context still isolates each sample's application
  state from earlier navigations.
- The event timestamp starts the clock, including SvelteKit's scheduling before its public
  navigation callback. `firstMotion` records the first nonzero source update;
  `firstSubmitted` records completion of its synchronous CPU render submission. Neither is
  a GPU-completion or physical-display timestamp. A separate RAF probe observes actual DOM
  position changes, not merely a changed class or loading indicator.
- The instrumented adapter is the one the application requests. CPU, operating system,
  browser, viewport and adapter information accompany the samples. Installed discrete
  hardware is not assumed to be the selected GPU.
- No sample is removed. Reports include the median, nearest-rank p95 and maximum. Partial
  reports remain available when an assertion fails; the analyzer cannot certify them as
  a completed twenty-sample run.
- Per-sample resource, route-temperature and runtime assertions are soft so their failure
  does not discard the remaining planned samples. Each sample retains `validationErrors`;
  `noSampleValidationErrors` must pass before the run is eligible for acceptance. A missing
  validation record is unknown, never an implicit pass. Failed samples remain in all raw
  distributions. Missing/nonpositive DOM observations similarly prevent latency acceptance.
- GPU creation calls are forbidden from activation through the final moving submission,
  including preparation before the controller's `moving` phase. The functional suite also
  verifies no destination mount, source replacement or child-list mutation during movement.
  `noGpuCreatesDuringReveal` checks the separate exact reveal interval, including its
  endpoints. Neither waiting/binding allocations nor later refinement are attributed to it.

## Frame attribution

Each sample stores continuous absolute RAF timestamps from before activation through the
completed reveal. `budget` is the idle baseline measured before the application loads;
`sourceBudget` records the source page's cadence separately. Both animation gates use the
idle baseline. A source already running at 30 Hz on a 60 Hz display must not silently
double the allowed frame interval.

The two visual phases have separate, exact intervals:

| Phase | Start | End | Gate |
| --- | --- | --- | --- |
| Source movement | `firstMotion` | `motionEnded`, after the final source submission | `noMovingRafGapAboveTwoBudgets` |
| Content reveal | `revealStarted` | `revealEnded`, after the final reveal submission | `noRevealRafGapAboveTwoBudgets` |

The analyzer reports full gaps inside each phase and the clipped phase portion of boundary
gaps. Either is a violation when its duration exceeds twice the idle budget. Thus a long
gap spanning the whole reveal still fails even when there is no pair of RAF samples inside
it. The samples must cover both boundaries; a recording stopped before the last frame
cannot produce a pass. An already observed violation still fails even when later coverage
is incomplete. The harness should wait until a recorded RAF timestamp reaches the final
`revealEnded` marker before collecting the sample. Raw intervals and unattributed violations
remain in the report.

The interval between `motionEnded` and `revealStarted` includes static holding, waiting and
destination binding. It is reported separately; its entire duration is not claimed as CPU
binding time. Final adoption after `revealEnded` is also outside the reveal animation. The
later `revealed` completion marker must not substitute for its last visual submission.

Long Animation Frame entries can begin during movement and finish after a long binding
operation. Attribute their scripts by actual time overlap; do not assign the entire entry
to movement based only on its start. The same rule applies to a long binding script ending
before `revealStarted`: it contributes zero reveal time even if its containing frame extends
into reveal. Straddling scripts contribute only their overlapping duration. Forced-layout
totals have no internal timestamp, so the analyzer does not proportionally invent their
phase attribution. Conversely, a long interval with little JavaScript is
still a real scheduling gap. It cannot be dismissed as smooth merely because no new shader
or texture was created. GPU/compositor traces are needed before assigning its cause.

`node scripts/analyze-staged-performance.mjs --self-test` checks those interval rules,
including a long hold script with zero overlap with movement, binding before reveal,
partially overlapping scripts, full-phase boundary gaps and missing end coverage. Old
captures lacking exact markers are reported as incomplete rather than retroactively passing
a stricter gate. Both an embedded `profiled: true` flag and sibling CPU-profile artifacts
exclude a run from acceptance, even when its numerical thresholds happen to pass.

## Acceptance scope

The software gates cover source ownership, cancellation, known hero/compact/3XL endpoints,
native history, reduced motion and resource reuse. The timing target is p95 below 100 ms
for first movement, first CPU submission and observed DOM movement. Source movement and content reveal each have
a separate gate against intervals longer than two idle frame budgets; a fast click response
does not compensate for later reveal stalls. Frame-pacing acceptance requires complete
coverage in every sample of the unprofiled twenty-sample run, with no samples discarded.
Actual Android, iOS and Surface touch/sensor testing remains a separate physical-device
check. Desktop automation does not establish universal frame pacing or sensor behavior.

Final accepted timing results and their source revision are recorded here after the
repeated production run. Diagnostic captures remain local in `.artifacts/`; they are not
substituted for that acceptance run.
