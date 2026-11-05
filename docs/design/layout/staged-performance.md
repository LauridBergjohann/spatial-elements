# Staged navigation: production measurement protocol

This report accompanies the [source-readiness contract](staged-gpu-readiness.md) and
[implementation plan](../../layout-system-implementation-plan.md). Functional correctness,
GPU resource reuse and input latency are separate gates. A successful resource probe does
not establish smooth animation or a latency percentile.

## Current verified boundary

The fully verified source checkpoint `52c342e`, including tabs `83ea019` and fullscreen
ordering `6e79c9a`, passes **936/936 units in 119 files** (run `46764`) and all
workspace checks with **0 errors / 0 warnings** (run `97989`). Package build
`67527`, demo build `39337` and Examples build `82285` each exit successfully.
The complete public production matrix also passes **24/24 together** on demo
`39337` / runtime `83ea019` (run `98004`, exit 0), with artifacts in
`.artifacts/staged-production-39337-83ea019`. This is a new complete run, separate
from the earlier `8873f41` matrix and the targeted private/fullscreen cases.
The two fullscreen browser cases also pass on demo build `39337` (run `3553`,
exit 0): retained fallback pose is within 1 CSS pixel before binding/movement,
and native exit plus resize leaves a usable destination. The isolated packed
consumer also passes (run `76173`, exit 0): 460 Core and 118 Svelte allowlisted
files, independent temporary installation, automatically installed Three peer,
Core import without DOM/GPU, Svelte check 0/0 and SSR production build.

This used offline npm with the workspace cache after an initial global-cache
`EPERM` and an aborted network retry with `EACCES`; neither failed attempt is
reported as a successful consumer run. Evidence:
`.artifacts/layout-history-fixes-package-consumer-offline.log`, temporary consumer
`spatial-elements-consumer-be4kMc`. These are the already built history-fix package
bytes (Svelte runtime `83ea019`, Core `8873f41`, source checkpoint `52c342e`), not
the subsequent deferred-warmup work in progress. Release metadata, six release
tests, boundaries, generated layout and Wiki 13-page/31-image validation also
pass (run `92806`, exit 0). The earlier results below retain their own revisions.

The subsequent deferred-scroll-warmup commit `60deaac` has 76 focused unit passes,
type checks and successful package build `23283`; its demo build `27554` is in
progress and browser acceptance is not yet established. The 936-unit, 24-case,
package-consumer and performance evidence above does not certify that later
runtime. No warmup performance benefit is inferred from its source or unit checks.

Runtime `8873f41`, demo build `10039` (pixel-proof fixture `6a2ed1f`), passes
**914/914 unit tests in 116 files**, all workspace checks with **0 errors / 0 warnings**,
and the complete **24/24 public production navigation matrix** (run `27302`, exit 0).
The [StageDisplay proof](stage-display-clear.md), recorded in `13be2b4`, has 24
exact linear HalfFloat and final Canvas comparisons with no GPU validation errors.
Its twelve standard cases use 2 submissions instead of 4; twelve fallback cases
remain 4 versus 4. These counts isolate one display call. A subsequent unprofiled
cohort includes StageDisplay, but does not isolate its effect on navigation pacing.

Evidence: `.artifacts/layout-display-clear-units.log`,
`.artifacts/layout-display-clear-check.log`,
`.artifacts/layout-display-clear-package-build.log`,
`.artifacts/layout-display-clear-resize-demo-build.log`,
`.artifacts/staged-production-10039-8873f41`, and
`.artifacts/stage-display-clear-10039-6a2ed1f`.
Examples `6938b45` built with framework `8873f41` in build `44157`; private run
`6701` retained its **4/6 passed, exit 1** result. The ambiguous tooltip selector
was corrected in Examples `d557914`. The real stale-data/Carousel-snippet failure
was traced to Kit's asynchronous `onNavigate` hold and corrected by synchronous
source capture in `039b8e2`. The same six ordinary carousel/header cases now pass
**6/6** on Examples build `20223` / framework `039b8e2` (run `16117`).

The two additional immediate-Back tests in Examples `be739a1` are separate: on
that runtime both restore the correct URL, all eight items, focus and history
length, but fail their strict empty-error assertion on a null tab-measurement
binding before reaching the subsequent complete roundtrip-state comparisons.
The failed traces remain in the private host's
`.artifacts/layout-regression-039b8e2-fast-back`. Follow-up `83ea019` passes seven
focused lifecycle units. Its two production retests now pass on Examples build
`82285` / framework checkpoint `52c342e` (run `89730`, exit 0), including all
subsequent Back/Forward state comparisons and empty page errors. Evidence is in
the private host's `.artifacts/layout-regression-82285-83ea019-fast-back`.
Fullscreen ordering correction `6e79c9a` has 28/28 focused units and the two
separate production browser passes recorded in the [capture contract](synchronous-navigation-capture.md).
These results are not folded into the older 914-unit or 24-case totals.

The latest unprofiled cohort is the four synthetic diagnostic samples on build
`10026` / `039b8e2`, recorded below. All twelve start gates pass, but three
calibrations are unstable and raw approximately 50ms frame gaps remain. Neither
n=1, profiled traces, pixel equivalence nor
functional passes satisfy the repeated performance gate. General activation
(step 14f) remains open and the feature stays opt-in through `?stagedNavigation=1`.
Historical raw data and failed results remain unchanged.

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
later `revealed` finish-hook marker must not substitute for its last visual submission;
it is recorded before ownership cleanup and does not measure that work's completion.

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

## Additional cadence diagnostic, version 1

`cadence-diagnostic-v1` is declared before the next repeated measurement. It supplements
the original raw frame gates; its labels do not change their budget, thresholds or earlier
outcomes. The separate version-2 eligibility requirement below now also requires usable
calibration evidence. A borderline observation is **not a pass**. This is a
diagnostic protocol for the declared 60 Hz test environment, not a universal browser rule.

Before loading the application, the harness records **121 consecutive RAF timestamps**
on the empty document. `budget` remains the median of the first eleven gaps, exactly as
before. The extra idle samples do not add any source-page settling time or warm target
route data. The complete timestamps are saved in each sample's `idleCalibration`, with
`version: "cadence-diagnostic-v1"` and their pre-navigation clock origin. They must not be
compared numerically with timestamps from the subsequently loaded application's document.

The additional period estimate is `T = (t120 - t0) / 120`. Unlike the median of individual
quantized intervals, this cancels the inner timestamp errors algebraically. For example,
*if* each endpoint were known within 0.1 ms, the corresponding period error would be at
most 0.2/120 ms. That assumption is not a specification guarantee: High Resolution Time
allows coarser implementation-defined resolution and jitter. Thus the protocol does not
claim a clock-accuracy bound or a statistical confidence interval.
[W3C High Resolution Time](https://www.w3.org/TR/hr-time-3/#dfn-coarsen-time).

All of these predeclared conditions must hold for the additional calibration to be stable:

- Exactly 121 finite, strictly increasing timestamps are present with the known version.
- The full-span period lies in **[16.0, 17.5] ms**.
- Every individual idle gap lies in **[0.75T, 1.25T]**.
- The two 60-interval half-span period estimates differ by at most **0.05 ms**.

No idle sample is removed and no automatic retry seeks a favourable calibration. A known
record outside these stability conditions is `unstable`; missing, malformed or unknown
versions are `indeterminate`. Both prevent cadence classification. Neither alters the raw
animation-gate result. In particular, a 30 Hz source or idle cadence cannot become a
relaxed reference for this 60 Hz protocol. Rendering opportunities are selected by the
browser and may change with hardware, visibility and workload; RAF timestamps alone do
not prove a physical display refresh rate or an actual presentation time.
[HTML rendering opportunities](https://html.spec.whatwg.org/multipage/webappapis.html#rendering-opportunity).

For a stable calibration, complete RAF gaps **inside** movement or reveal receive a
separate descriptive label:

| Full gap duration | Diagnostic label | Interpretation |
| --- | --- | --- |
| Below `2T - 0.5 ms` | `below-two-period-band` | Clearly below the declared boundary band |
| From `2T - 0.5 ms` through `2T + 0.5 ms` | `two-period-borderline` | Compatible with two nominal periods; unresolved, **not passed** |
| Above `2T + 0.5 ms` | `above-two-period-band` | Clear excess beyond this bounded diagnostic zone |

The fixed **±0.5 ms** is a deliberately limited protocol zone, not proof that all variation
inside it came from quantization. Each gap retains its raw duration, raw-gate result,
`duration/T` and signed `duration - 2T` offset. For a stable 60 Hz baseline, 33.3–33.5 ms
can therefore be distinguished from an unequivocal roughly three-period 50 ms interval
without changing a single strict-gate failure. Even the slowest allowed reference has an
upper band edge of only **35.5 ms**: neither 40 ms nor 50 ms can be rounded away.

Boundary gaps retain their complete raw duration and clipped phase overlap, but receive
no frame-count classification. Earlier binding work must not become a reveal stutter just
because a gap crosses the phase boundary. Missing coverage similarly leaves phase-level
diagnostic status indeterminate. The analyzer reports calibration counts separately from
all acceptance gates. Old measurements without the new raw calibration remain unknown;
the first 80-sample run below is not retrospectively relabelled or accepted.

The analyzer self-tests cover quantized calibration, unknown versions, malformed records,
30 Hz rejection, missed idle intervals, changing cadence, 33.x/40/50 ms separation,
unclassified phase boundaries and exact preservation of the existing gates.

## Measurement protocol revision 2

`staged-performance-v2` is a prospective measurement revision, recorded on every sample
and complete/partial report. It corrects two measurement issues without changing the
original raw thresholds or replacing historical data:

1. The DOM-start probe stops querying the source rectangle after its first confirmed
   position change. Previously, its timestamp stopped changing but its rectangle read
   continued on every moving RAF. Those unnecessary reads could force style/layout work
   inside the animation being measured. The first-observation condition and clock remain
   unchanged; continuous RAF recording still runs through the final reveal frame.
2. Frame-pacing acceptance requires a usable baseline for the declared 60 Hz environment.
   Each sample must have the known measurement revision, the existing stable
   `cadence-diagnostic-v1` calibration, its explicit blank-document/RAF-clock provenance,
   and visibility confirmed throughout calibration. The recorded raw `budget` must equal
   the median of that calibration's original first eleven gaps. The 121 timestamps still
   do not replace that budget or relax either raw gate.

Visibility changes are observed only during blank-document calibration and the listener
is removed afterward. An unknown revision, missing evidence, hidden calibration, unstable
cadence or inconsistent recorded budget makes the sample ineligible for frame-pacing
acceptance. All samples remain in the raw distributions; there is no retry or filtering
to find a favourable baseline. `framePacingBaseline` exposes per-sample reasons and the
report's usable-sample count. This requirement is additional to complete phase coverage,
runtime validation and the unprofiled twenty-sample requirement.

In particular, a 30 Hz idle measurement could make a 50 ms gap numerically pass the
unchanged raw `2 × budget` gate. Version 2 leaves that raw result visible but refuses it
as evidence for a 60 Hz acceptance. A report is acceptable only when
`eligibleForFramePacingAcceptance` is true **and** both raw phase gates pass. Eligibility
alone can also describe a valid measurement which conclusively fails those gates.

Old files are not rewritten, retroactively assigned a version or accepted under the new
protocol. Their raw gaps, percentiles and raw gate outcomes remain reproducible; their
missing version-2 evidence blocks a new frame-pacing acceptance. Prior latency/resource
statistics keep their recorded meaning. New runs must identify this measurement revision,
so reduced probe overhead is not confused with a product-code improvement.

Self-tests retain the old raw-gate comparisons and add complete/mixed/missing baseline
evidence, unknown revisions, hidden and unstable calibration, budget consistency, the
30 Hz false-acceptance case, and genuine 50/133 ms failures with a valid 60 Hz baseline.
No tolerance band becomes an acceptance rule: the ±0.5 ms labels remain diagnostic only.

## Separate trusted warm-input cohorts

`SPATIAL_PERFORMANCE_ACTIVATION` adds an explicit input dimension while preserving
`staged-performance-v2` and every existing raw gate:

| Value | Cohorts | Activation |
| --- | --- | --- |
| `synthetic` (default) | List/Carousel, Cold/Warm | Existing `node.click()` path, unchanged |
| `pointer` | List/Carousel, Warm only | Playwright mouse down/up at the normally hovered link |
| `enter` | List/Carousel, Warm only | Focus the real link, then Playwright `Enter` |

The trusted modes retain normal hover/focus preload and press/release behavior. They do
not disable application listeners, add source settling waits, or replace the synthetic
Cold/Warm measurements. Each report and sample records `activation`; test titles also
distinguish trusted cohorts. Run each mode into a separate artifact directory, for example:

```powershell
$env:SPATIAL_PERFORMANCE_ACTIVATION='pointer'
npx playwright test --config playwright.staged-performance.config.ts --output=.artifacts/staged-performance-pointer
$env:SPATIAL_PERFORMANCE_ACTIVATION='enter'
npx playwright test --config playwright.staged-performance.config.ts --output=.artifacts/staged-performance-enter
Remove-Item Env:SPATIAL_PERFORMANCE_ACTIVATION
```

Capture listeners record actual trusted pointer-down/up or Enter keydown and the resulting
click, including event timestamps and observation times. The existing latency gates remain
anchored to the **click event timestamp**, never to the start of a Playwright command. The
analyzer separately reports input-start-to-click/movement/submission/DOM-observation
latencies as diagnostics; those values neither replace nor relax the click-based gates.
`inputPreparation` separately retains GPU calls in `[pointerDown/keyDown, click)` and
raw Long Animation Frames overlapping that interval, including their script records.
The analyzer reports actual frame/script overlap with this interval without attributing
an entire straddling frame to the press. GPU calls at the click timestamp belong to the
existing click-based field. This diagnostic exposes normal press preparation without
mixing it into `gpuCalls`, `longFrames` or any original raw gate.
Trusted acceptance requires the corresponding trusted events and the same click timestamp
as the transition clock. Samples with missing or inconsistent evidence remain recorded
but cannot establish acceptance.

The analyzer rejects mixed activation types, report/sample label mismatches and trusted
Cold cohorts before pooling statistics. Historical files lacking activation metadata remain
`legacy-unspecified`; they are not silently relabelled as trusted or merged into a new
explicitly labelled cohort. Their original raw measurements and gates remain unchanged.
The analyzer self-tests cover these separation rules and the unchanged v2 raw outcomes.

## Acceptance scope

The software gates cover source ownership, cancellation, known hero/compact/3XL endpoints,
native history, reduced motion and resource reuse. The timing target is p95 below 100 ms
for first movement, first CPU submission and observed DOM movement. Source movement and content reveal each have
a separate gate against intervals longer than two idle frame budgets; a fast click response
does not compensate for later reveal stalls. Frame-pacing acceptance requires complete
coverage and usable version-2 baseline evidence in every sample of the unprofiled
twenty-sample run, with no samples discarded.
Actual Android, iOS and Surface touch/sensor testing remains a separate physical-device
check. Desktop automation does not establish universal frame pacing or sensor behavior.

## First repeated run — not accepted yet

On 2026-10-31, the production build containing `c64f3f8` and `f2f12d2` completed all
80 planned hero samples. The harness includes `2144829`; analysis uses `83d47fd`.
Environment: Windows `10.0.26300`, Intel Core i7-1065G7, the requested Intel `gen-11`
WebGPU adapter, Chrome `156.0.8078.79`, 1440 × 1000 CSS pixels, DPR 1. Runs were serial,
without concurrent builds or other test browsers. No measured sample was discarded.

Each timing cell is **median / p95 / maximum**, in milliseconds:

| Source / route cache | Samples | First source update | CPU submission | Observed DOM position change |
| --- | ---: | ---: | ---: | ---: |
| List / cold | 20 | 54.2 / 72.8 / 78.4 | 64.1 / 86.2 / 87.8 | 68.2 / 90.6 / 94.0 |
| List / warm | 20 | 42.8 / 52.4 / 72.5 | 54.7 / 67.3 / 87.4 | 62.3 / 76.8 / 96.0 |
| Carousel / cold | 20 | 74.4 / 91.7 / 94.5 | 92.5 / 111.5 / 114.9 | 99.5 / 118.7 / 124.4 |
| Carousel / warm | 20 | 58.2 / 67.1 / 73.1 | 76.3 / 88.5 / 97.1 | 82.8 / 96.3 / 104.3 |

All 80 samples passed the route-cache and application-error checks and created no GPU
resources during source movement or content reveal. The cold carousel failed the submission
and DOM-observation latency gates. **All four groups failed frame-pacing acceptance.**
In addition to the raw 33.x ms threshold crossings retained by the analyzer, repeated roughly
50 ms or longer intervals occurred inside reveal in 11/20 cold-list, 18/20 warm-list and
20/20 samples of each carousel group. These are not dismissed as timestamp rounding.

Several warm-list Long Animation Frames contain 36–44 ms in the reveal controller's actual
render callback, without reported forced layout. A cold-list outlier records its first DOM
position change at 94 ms but its containing frame's presentation at about 190 ms. Therefore
the DOM probe must not be described as a guaranteed displayed-pixel response. CPU/GPU/Viz
traces investigate both render work and the delay before SvelteKit's navigation callback.
No general activation is justified by this run.

Raw results and the complete analysis are retained locally in
`.artifacts/staged-performance-c64f3f8-hero1440/` and
`.artifacts/staged-performance-c64f3f8-hero1440-analysis.json`. Compact and 3XL repeated
acceptance runs follow only after the shared render/start causes have been addressed.
Physical-device checks remain separate. Later accepted results must name their own source
revision; these measurements must not silently be relabelled as results of a later fix.

## Follow-up diagnostic on 362b98a — still not an acceptance run

Build 54041 corresponds to runtime **362b98a** (including the reveal changes in `d997b46`,
cadence diagnostics in `45c7154`, and the tabs correction). On the same 1440 × 1000,
DPR 1 Windows/Intel setup, four serial, unprofiled **n = 1** hero samples produced:

| Source / route cache | First source update | CPU submission | Observed DOM change | Clear cadence excesses: moving / reveal |
| --- | ---: | ---: | ---: | --- |
| List / cold | 45.0 ms | 56.8 ms | 61.8 ms | none / none |
| List / warm | 39.6 ms | 48.8 ms | 55.4 ms | none / none |
| Carousel / cold | 69.3 ms | 94.5 ms | 98.9 ms | none / 50.1, 50.0 ms |
| Carousel / warm | 68.3 ms | 90.6 ms | 97.4 ms | 49.7 ms / 49.9, 50.1, 49.9 ms |

All four idle calibrations met the predeclared stability conditions; estimated periods
were approximately 16.667 ms. The last column lists only complete phase-internal gaps
above `2T + 0.5 ms`. Borderline gaps remain in the raw data and are **not passes**. The
unchanged raw moving/reveal gates passed only for cold List; both raw phase gates failed
for the other three samples. No GPU resources were created during movement or reveal,
and application/cache validation reported no errors. Four individual responses below
100 ms do not establish p95 acceptance. The roughly 50 ms Carousel gaps remain real,
unresolved pacing failures. Interphase loading/binding/preparation lasted approximately
1.47–2.28 s; that interval is retained separately rather than counted as moving/reveal CPU.

A subsequent, isolated **warm Carousel trace on the same runtime** used CPU samples,
GPU/Viz events, queue fences and optional phase-edge stage snapshots. It confirmed two
distinct sources of work:

- During reveal, sampled inclusive CPU in `renderCarouselRear` was about **64.1 ms**,
  including **57.4 ms** inside `CarouselGlassCompositor.render`. At the first revealing
  snapshot there were **zero catalog actors and ground silhouettes**, but one retained
  glass panel; glass pass count continued from 33 to 40 while catalog geometry and depth
  blur pass counts stayed unchanged. The snapshot interval includes phase-edge/cleanup
  work, so these deltas are not exact reveal-only pass totals. The trace recorded no
  resource creation or shader compilation during reveal. The live glass draw is still
  necessary; the entire measured rear cost is not removable.
- Before the click, the stage snapshot was idle with no pending RAF or preparation job.
  A `focusin` event registered a new stage RAF **4.25 ms after the click**. That RAF ran
  at +11.92 ms and occupied approximately 40.08 ms; SvelteKit's following RAF/timer then
  entered the navigation adapter at +66.1 ms. There were 49 GPU submissions and no GPU
  resource creation before adapter entry. This identifies a newly requested focus render,
  rather than a render loop already active at the idle snapshot. It is a separate start
  issue from retained rear work during reveal.

Tracing, CPU profiling, fences and snapshots perturb timing. Their absolute durations do
not replace unprofiled latency or pacing measurements. Raw artifacts remain local under
`.artifacts/staged-performance-54041-362b98a-hero1440-n1/` and
`.artifacts/staged-gpu-trace-54041-362b98a-carousel-warm/`.

The resulting narrow cache change treats **only exactly zero outgoing opacity** as a
known-empty rear. It retains the transparent capture and the mathematically identical
opaque-white blur result for each radius/size, while continuing to draw the actual glass
matrix and opacity. Live captures invalidate all blur keys, including inactive keys;
resize and failed writes cannot reuse stale results. Once no geometry or retained glass
contributes, the separate rear canvas is cleared once and then paused until output or
size changes. These cached clears explicitly disable and restore scissor: the Stage's
`navigator.gpu` check does not prohibit Three's WebGL backend fallback after initialization
failure, and its clear is scissor-dependent. CPU regression tests cover these invariants.
**The performance effect of
this cache is not measured in the 362b98a results above and is not yet an accepted gain.**

## Version-2 diagnostic on 02dc683 — not accepted

Production build 53025, runtime `02dc683`, and harness `fe30604` completed all four
synthetic Hero1440 **n = 1** cases, serially without profiling or concurrent test/build
load. All four version-2 blank-document calibrations were stable and usable. Every
sample retained zero application GPU resource creations during movement and reveal,
and no application/cache validation error. No sample was retried or discarded.

| Source / cache | First source update | CPU submission | Observed DOM change | Raw Moving / Reveal gates |
| --- | ---: | ---: | ---: | --- |
| List / cold | 53.6 ms | 66.9 ms | 73.7 ms | fail / fail |
| List / warm | 44.4 ms | 54.0 ms | 60.8 ms | fail / fail |
| Carousel / cold | 102.1 ms | 121.4 ms | 125.7 ms | fail / fail |
| Carousel / warm | 27.9 ms | 47.6 ms | 52.6 ms | pass / fail |

The runner completed with three passing cases and the cold Carousel latency failure;
all four complete reports were saved. Clear approximately 50 ms internal gaps remain
in every reveal and in all movements except warm Carousel. The original raw 33.x ms
threshold crossings remain failures too. These are diagnostic values, not p95 results.
Raw files, calibration details and complete gap lists are retained in
`.artifacts/staged-performance-53025-02dc683-v2-hero1440-synthetic-n1/`.

Three separate profiled traces on this runtime distinguish the remaining work:

- A trusted warm Pointer trace confirms the specific Ground winding fix in `02dc683`:
  no new GPU resources from click through first submission, movement or reveal. Its
  positive-opacity rear draws still cost about 26–37 ms with 49 submissions, falling
  to mostly 9–14 ms and 14 submissions after the rear fade. Actual glass stays live.
- A cold Carousel trace starts from an idle source. A newly requested source RAF
  before Kit's navigation callback lasts about 44 ms with 51 submissions and no GPU
  creation; Ground/depth-blur work contributes materially. Adapter entry is +87.5 ms
  in this profiled trace. An idle snapshot alone does not eliminate click-induced work.
- A warm List trace has mostly 4–10 ms moving callbacks. One roughly 50 ms gap overlaps
  browser raster/Skia work and two approximately 9 ms ANGLE shader compile/link waits.
  This is separate from the application's WebGPU hooks. The trace does not identify
  a particular CSS declaration as the cause. The card's unfrozen child hover/focus
  transitions are a separately confirmed presentation gap, not a proven explanation
  for those raster stalls.

Raw traces and interpretation are local under
`.artifacts/staged-gpu-trace-53025-02dc683-{carousel-warm-pointer,carousel-cold,list-warm}`
and `.artifacts/staged-gpu-trace-53025-02dc683-followup.md`. Instrumented durations must
not be promoted to unprofiled acceptance measurements.

The subsequent [scene endpoint pixel proof](scene-endpoint-pixel-proof.md) uncovered a
separate double-premultiplication error in the background cover, corrected by
`ca8e59e`. Its fixture-only corrected overlay control supports investigating bounded
endpoint reuse; it does not validate a production cache or establish a speed gain.
Neither that correction nor the new Ground/scene pixel-cache work was present in the
measurements above. New runtime evidence is required before general activation.

## Trusted activation and ground readiness follow-up on 1b1aadd

Two serial diagnostic traces on Demo build 57415 used a real pointer click and Enter
activation of a previously focused link, with warm route data. Both retained the actual
trusted event timestamp; profiling/fences make their absolute durations unsuitable for
latency acceptance. The pointer trace recorded a Stage RAF requested by `pointerdown`
before SvelteKit entered the navigation adapter. That RAF created two Ground
`MeshBasicMaterial` pipelines in the HalfFloat DepthBlur capture, with opposite winding.
The subsequent focus events requested no additional RAF. Enter requested no pre-adapter
Stage render or GPU creation. Neither trace created GPU resources during moving/reveal.

The empty-rear cache removed seven submissions from comparable reveal draws (initial
32 to 25, Low/High refinement 48 to 41, retirement 54 to 47); the final draw remained 29.
Different numbers of animation frames prevent comparing summed submission totals as a
percentage gain. Repeated long reveal callbacks still occurred. These observations do
not establish smoothness or p95 acceptance. The full traces and attribution are retained
under `.artifacts/staged-gpu-trace-57415-1b1aadd-carousel-warm-pointer/` and the corresponding
`-enter/` directory; the earlier four unprofiled samples are unchanged.

Ground readiness now additionally pins both winding variants using separate persistent
render-object owners that share the live shadow geometry and owned material. The shadow
projection is mathematically singular, and floating-point recomputation can change the
sign used by Three's pipeline cache. Preparation draws only into the same bounded 512²
DepthBlur target, without a resolve onto any visible output; the existing GPU fence must
complete before staged readiness is published. The owners leave with their shadow and
material. Tests against the installed Three pipeline/cache implementation demonstrate
why changing the same owner twice loses a previous variant, and why retaining separate
owners prevents that eviction. The tests also cover shared-resource ownership, target
and visibility restoration, and rejected readiness on failure. The subsequent trusted
Pointer trace on `02dc683`, described above, confirms that these winding pipelines are
no longer created at activation. It does not establish latency or pacing acceptance.

## Endpoint-cache integration on d92a3b9

Three separately committed changes address the measured work without changing the
acceptance protocol: [per-shadow Ground reuse](staged-ground-cache.md) (`26d2778`),
[held Hero scene endpoints](staged-scene-endpoint-cache.md) (`e2970b7`, with conservative
eligibility limits in `d92a3b9`), and [retained card appearance](staged-card-appearance.md)
(`9ff92fc`). The card change closes a confirmed hover/focus consistency gap; it is not
yet a proven explanation or cure for browser raster stalls.

Build 95956 proved Ground pixel parity, 48 independent scene-endpoint comparisons,
48 comparisons through the actual runtime cache, and real List/Carousel reveal hits.
Card pointer/keyboard appearance and cancellation passed for both Hero and Dock.
The linked reports preserve the initial fixture failures, corrected fixture runs,
storage-rounding limits and separate successful-result recording runs. No failed
performance sample was removed or relabelled.

The final combined package/Demo build 2616 uses `d92a3b9`, including the subsequent
conservative Instanced Ground and nonphysical scene-input exclusions. All workspace
typechecks report zero errors/warnings, and the complete unit run passes 840/840 tests
in 114 files. Logs: `.artifacts/layout-endpoint-final-{package-build,demo-build,check,units}.log`.
These are correctness/integration checks; new production navigation and unprofiled
timing evidence are required before judging latency, frame pacing or general activation.

The subsequent unchanged v2 n=1 diagnostic on this build retained all four complete
samples (runner 46651: three passed, cold Carousel failed the DOM-start assertion).
First motion / CPU submission / observed DOM change, in milliseconds:

| Case | Motion | Submission | DOM observation |
| --- | ---: | ---: | ---: |
| List cold | 55.3 | 63.9 | 68.5 |
| List warm | 36.6 | 45.7 | 50.1 |
| Carousel cold | 86.7 | 98.0 | **100.2** |
| Carousel warm | 34.3 | 50.2 | 53.9 |

All click-through-motion and reveal resource-creation counts are zero, with no sample
validation errors. List warm and Carousel cold have stable blank-document calibrations;
List cold and Carousel warm are unstable, including respective 316.7/283.3 ms initial
blank-document gaps. Those samples remain recorded and cannot establish frame acceptance.
The raw gates and original budgets were not adjusted.

Neither List sample contains an internal 50 ms interval (maxima 33.7 ms); raw 33.x ms
failures still apply. Cold Carousel retains a 50.0 ms moving interval and 49.8 ms reveal
interval; warm Carousel has a 50.1 ms reveal interval with indeterminate calibrated
classification. Their reveal gaps end 127.5/170.8 ms before the phase ends, so the final
reveal callback alone cannot explain them. Cold Carousel also has a 33.1 ms ordinary
source-render callback before adapter entry, despite an idle source at activation.
That callback, actual Ground reuse and the independent refinement clock require a
new trace. No isolated speed gain or p95 acceptance follows from these four samples.

Raw data and the complete calibration/boundary/cleanup analysis are in
`.artifacts/staged-performance-2616-d92a3b9-v2-hero1440-synthetic-n1/` (`summary.md`,
`compact.json` and unchanged measurements), with the sibling `-analysis.json` report.
The full functional run on this build separately found a Ground-only preparation
readiness race: 19/24 cases passed, five Carousel cases declined early navigation
before capture. This is a functional regression to fix, not a performance sample to
discard or a reason to extend the test's pre-click wait.

`ebeed3e` separates the synchronous borrowed-scene readiness blocker from the
optional Ground-only GPU fence. Mandatory actor preparation still blocks readiness.
The five declined cases and an additional Escape case passed on build 5312 (6/6);
the original 19 successes and these five corrected cases provide the 24-case
functional coverage across runs, not a second complete 24-case run. The focused
26-unit regression suite includes reentrancy, cancellation and rejected fences.

## Activation and final-paint follow-up

A separate cold Carousel trace on build 5312 / `ebeed3e` confirms actual Ground
reuse: 21 additional cached shadow draws, no live fallback and no preparation over
click and movement. Nevertheless the click schedules a 33.235 ms ordinary source
RAF with 39 GPU submissions before the navigation adapter. The source was idle
before activation. `8eaf276` coalesces only the selected Carousel's programmatic
activation-focus invalidation; native DOM focus remains immediate, and Tab,
pointer press, hover and neighbour selection keep their ordinary scheduling.
Without navigation, the queued focus request still reaches the regular renderer.
The [focus contract](catalog-activation-focus.md) records that narrow extra paint
opportunity and the separate browser proofs.

The trace's internal 50 ms moving interval contains only 4.1 ms controller work.
The GPU service thread is busy for about 48.7 ms of that interval; WebGPU command
decoding occupies about 42.7 ms inside it. These are nested CPU service spans,
not exclusive GPU execution times and not additive. They identify command-service
load, but do not isolate a particular shader or prove that the focus change removes
the gap. No new application GPU resources are created during movement or reveal.

High remains loading throughout this cold reveal: the Hero and rail preview stay
Low, refinement records zero frames, and the scene-endpoint cache is unused. The
remaining panel/minimap passes are necessary for the actual visible surface; the
retained Carousel rear contains only the selected fading glass. Consequently this
trace cannot establish either a cold scene-cache gain or a refinement-related stall.

The final reveal callback lasts about 73 ms, with only about 17 ms before the
unchanged reveal-end marker. Promise continuations previously performed ownership
cleanup before that frame could paint. `2218421` adds an abortable paint opportunity
after the final summary commit and before cleanup. The [paint-order contract](staged-cleanup-paint.md)
preserves summary identity, cancellation and the original timing markers. It does
not reduce the final GPU draw or establish physical presentation timing.

All of these timings are diagnostic: tracing, CPU samples and queue fences add
overhead. Raw evidence is retained in
`.artifacts/staged-gpu-trace-5312-ebeed3e-carousel-cold/`. Fresh production browser
proofs and unprofiled measurements on the combined changes remain necessary.

Build 70245 / `8eaf276` subsequently passes all six separate activation-focus
browser cases and both real-summary final-paint cases. A new diagnostic trace
shows renderer Paint events after the last reveal draw and before the following
cleanup RAF. This confirms the intended paint ordering, not physical display
latency. It also retains 39 source-render submissions before adapter entry: a
separate microtask requests that frame, while the new focus callback itself is
lightweight. At that revision the redundant environment-ready notification was still under
investigation; focus batching alone had not removed the whole pre-adapter frame.
The subsequent isolated fix and matching trace are recorded below.

The unchanged, unprofiled v2 n=1 cohort on that build completes with all four
latency cases passing. Every sample is retained:

| Case | Motion | Submission | DOM observation | Raw Moving / Reveal gates |
| --- | ---: | ---: | ---: | --- |
| List cold | 53.2 ms | 62.5 ms | 67.6 ms | pass / fail |
| List warm | 45.9 ms | 54.1 ms | 58.0 ms | pass / pass |
| Carousel cold | 62.1 ms | 79.4 ms | 85.1 ms | fail / fail |
| Carousel warm | 22.4 ms | 31.5 ms | 34.1 ms | fail / fail |

All GPU-resource creation counts remain zero. Calibration is stable for three
samples; List cold has a 283.3 ms initial blank-document gap and remains unstable.
Warm Carousel failures are raw 33.x ms threshold crossings, not promoted to
passes. Cold Carousel still has internal 50.1/48.1 ms moving intervals and a
49.9 ms reveal interval, plus a boundary interval with 35.1 ms inside reveal.
Its subsequent 113.7 ms cleanup script is now outside reveal, but remains visible
as real follow-on main-thread work in the report. General activation and p95
acceptance remain open; these four samples do not establish an isolated gain.

Artifacts: `.artifacts/staged-performance-70245-8eaf276-v2-hero1440-synthetic-n1/`
and its sibling `-analysis.json`, plus
`.artifacts/staged-gpu-trace-70245-8eaf276-carousel-cold/`. The full unit suite on
this runtime passes 874/874 tests in 115 files; workspace checking is recorded
separately in `.artifacts/layout-focus-paint-check.log`.

## Readiness-notification follow-up: build 36109 / be72259

The isolated [readiness-notification fix](catalog-preparation-notifications.md)
removes the duplicate notification for an already-ready environment. In the
matching profiled cold Carousel trace, there are **zero GPU submissions and zero
GPU resource creations before adapter entry**. The deferred activation-focus
request is cancelled by transition takeover before its Stage RAF fires. The
previous build `70245` had an independently registered microtask-driven source
RAF with 39 submissions. This before/after trace supports the scheduling cause;
it is not an unprofiled latency sample or percentile result. Its application
markers are adapter 24.5 ms, first motion 46.7 ms and first submission 70.1 ms.
Evidence: `.artifacts/staged-gpu-trace-36109-be72259-carousel-cold` and the
preserved older trace; profiling and asynchronous diagnostic fences add overhead.

Separately, the unchanged, **unprofiled** v2 synthetic cohort at 1440 × 1000,
DPR 1, Chrome 156.0.8078.79 / Intel Gen-11 completes all four latency cases
(run `74227`, exit 0). There is one sample per source/temperature group, no
retry and no discarded sample. All acceptance-eligibility fields remain false.

| Case | Motion | Submission | DOM observation | Click to adapter | Raw Moving / Reveal |
| --- | ---: | ---: | ---: | ---: | --- |
| List cold | 80.0 ms | 90.0 ms | 95.7 ms | 54.5 ms | pass / fail |
| List warm | 43.2 ms | 50.4 ms | 60.1 ms | 32.1 ms | pass / fail |
| Carousel cold | 49.8 ms | 61.4 ms | 65.3 ms | 33.3 ms | fail / fail |
| Carousel warm | 29.7 ms | 48.5 ms | 55.2 ms | 13.8 ms | fail / pass |

All twelve start gates pass. Every sample has zero GPU creation calls from click
through movement and during reveal, and empty validation-error lists. **No case
passes all raw frame gates.** List cold has an unstable visible-document baseline
(183.3 ms initial gap, full-span period 18.0550 ms), so its supplementary cadence
classification is indeterminate. The other three calibrations satisfy the
predeclared criteria. Warm Carousel's source budget is 33.3 ms; it does not raise
the idle-baseline threshold.

There is no internal moving gap near 50 ms in this cohort, but cold Carousel has
an internal **36.1 ms moving gap** and **two 50.0 ms reveal gaps**. The latter are
wholly inside reveal, ending about 115.8 and 15.8 ms before its endpoint; they
cannot be reassigned to cleanup. Cold List also has an internal 50.0 ms reveal
gap and a reveal-end boundary gap with 36.8 ms inside the phase. Its unstable
calibration does not erase either raw failure. Other 33.x ms raw failures remain
failures, including borderline classifications; the thresholds are unchanged.
LoAF records no script overlap for the moving/reveal intervals in these samples.
That does not prove CPU absence or identify a GPU cause.

The separate profiled Carousel finding must not be generalized to all four
unprofiled inputs: cold List retains a 12 ms ordinary render script before its
adapter, and warm List still has hover/lift and a pending RAF at activation.
The hold/preparation intervals are 3176.5 / 1503.2 / 1391.2 / 1773.9 ms for
List cold/warm and Carousel cold/warm. They remain visible waiting time outside
the animation gates, not evidence of an entirely delay-free navigation.

Full evidence, including all raw gates, calibration timestamps, exact gaps and
retained samples: [n1 summary](../../../.artifacts/staged-performance-36109-be72259-v2-hero1440-synthetic-n1/summary.md),
[compact data](../../../.artifacts/staged-performance-36109-be72259-v2-hero1440-synthetic-n1/compact.json),
and [complete analyzer output](../../../.artifacts/staged-performance-36109-be72259-v2-hero1440-synthetic-n1-analysis.json).
These four samples establish neither p95 acceptance nor an isolated speedup.

## Cleanup and deferred work remain separate costs

The same unprofiled cohort retains post-reveal scripts of 63.5 ms (List cold),
52.5 ms (Carousel cold), and 40.2 ms (Carousel warm), with about 11–12 ms forced
style/layout each. The warm List sample has no later recorded LongFrame. These
scripts lie after reveal and must remain visible in the report. The completion
marker denotes entry into the finish hook, not the end of all cleanup work.

A separate offline audit of the profiled `36109` Carousel trace identifies:

- Cleanup RAF339: **69.006 ms**, starting 14.673 ms after `revealEnded`.
  Disjoint sampled-stack groups are completion 31.299 ms, focus 13.913 ms,
  optional High warmup 20.157 ms and other work 3.637 ms. The single final
  `flushCatalogFrame` is 27.082 ms **inside** completion, not an extra cost.
  Focus contains an 11.814 ms style recalculation. High is still loading / Hero
  Low at cleanup; resumed warming is not High adoption.
- Later optional zoom RAF347: **173.503 ms**, starting 108.384 ms after
  `revealEnded`. Inclusive `warmRenderTargetSets` is 54.942 ms and
  `prepareZoomEffects` is 116.965 ms; `renderMinimapBlur` 107.754 ms is nested
  inside the latter and must not be added again. This is neither cleanup nor
  High adoption.

The [audit report](../../../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.md)
and [JSON](../../../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.json)
define the exact timing windows and sampling rules. Monotonic weighting prevents
a recorded negative 39 μs CPU-profile delta from double-counting sample time;
the raw profile is unchanged. These profiled durations are not interchangeable
with the unprofiled script timings above.

No cleanup or zoom scheduling change follows from this audit. Separating optional
warmup from cleanup could redistribute work, not remove it. The already-deferred
zoom block would need smaller real work units or proven redundant-pass removal.
Reveal gates remain independent; shifted follow-on work is not relabelled as
eliminated animation cost. Pixelproof and the public functional matrix pass on the
new StageDisplay runtime. Subsequent private retests and the next unprofiled
cohort are recorded separately below; repeated acceptance, physical-device checks
and general activation remain open.

## StageDisplay and synchronous-capture follow-up: build 10026 / 039b8e2

The unchanged v2 synthetic Hero cohort ran serially and unprofiled at 1440 × 1000,
DPR 1, Chrome 156.0.8078.79, Windows / Intel Core i7-1065G7. Run `59216` completed
all four start-latency cases with exit 0. There is one sample per source/temperature
group, no retry and no discarded sample or calibration. The built runtime includes
StageDisplay `8873f41` and synchronous ordinary capture `039b8e2`; it does not
include the later fullscreen or tab-lifetime corrections.

| Case | Motion | Submission | DOM observation | Raw Moving / Reveal | Stable calibration |
| --- | ---: | ---: | ---: | --- | --- |
| List cold | 68.6 ms | 82.0 ms | 88.2 ms | fail / fail | no |
| List warm | 66.4 ms | 82.3 ms | 88.6 ms | pass / pass | no |
| Carousel cold | 64.6 ms | 77.7 ms | 81.5 ms | fail / pass | no |
| Carousel warm | 41.6 ms | 55.0 ms | 57.7 ms | fail / fail | yes |

All twelve start gates are below 100ms. Every sample records zero GPU creation
calls from click through movement and during reveal, with no validation errors.
All acceptance-eligibility fields remain false: this is not a repeated percentile
or frame-pacing acceptance run. In particular, warm List's passing raw frame gates
do not compensate for its unstable blank-document calibration.

Warm Carousel has a stable calibration but retains an internal 49.9ms moving gap
and 50.0ms reveal gap. Cold Carousel retains an internal 50.0ms moving gap. Cold
List retains an 83.3ms boundary gap with 39.3ms inside movement, plus internal
50.1ms and 50.0ms reveal gaps. These failures remain failures under the original
raw thresholds; no boundary is moved and no sample is relabelled or discarded.

Visible waiting/binding between movement and reveal is approximately 3.10s / 2.47s
for cold/warm List and 1.91s / 1.33s for cold/warm Carousel. Later recorded
LongFrame scripts are 55.7ms for cold List and 59.1ms for cold Carousel, including
14.4ms / 13.3ms forced layout. The other two samples have no recorded post-reveal
LongFrame; that does not establish an absence of follow-on work. The earlier
cleanup/zoom audit remains a separate profiled observation on its own revision.

Evidence: [summary](../../../.artifacts/staged-performance-10026-039b8e2-v2-hero1440-synthetic-n1/summary.md),
[compact data](../../../.artifacts/staged-performance-10026-039b8e2-v2-hero1440-synthetic-n1/compact.json),
and [complete analyzer output](../../../.artifacts/staged-performance-10026-039b8e2-v2-hero1440-synthetic-n1-analysis.json).
Original measurements and calibration timestamps remain in all four test
directories. This cohort is not pooled with trusted Pointer/Enter samples or any
earlier runtime. It establishes neither a StageDisplay-specific improvement nor
p95 acceptance; general activation remains blocked pending the required repeated
measurements and device checks.

## Offscreen scroll preparation follow-up: build 11873 / 960483f

Run `76630` completed the same unprofiled v2 synthetic Hero diagnostic at
1440 × 1000 with **4/4 start-latency cases, exit 0**. This build includes the
fullscreen/Tabs fixes and [offscreen scroll preparation](deferred-scroll-warmup.md).
There is one fresh-context sample per case, no retry or discarded calibration.

| Case | Motion | Submission | DOM observation | Raw Moving / Reveal | Stable calibration |
| --- | ---: | ---: | ---: | --- | --- |
| List cold | 54.5 ms | 60.8 ms | 64.7 ms | fail / fail | yes |
| List warm | 31.6 ms | 38.1 ms | 41.5 ms | pass / fail | yes |
| Carousel cold | 29.8 ms | 51.3 ms | 55.5 ms | fail / pass | no |
| Carousel warm | 25.6 ms | 35.2 ms | 38.4 ms | fail / fail | no |

All twelve start gates pass; every sample retains zero measured GPU-creation
calls during movement and reveal and no validation errors. Raw failures remain
unchanged: cold List has a 33.5ms moving gap and a 66.6ms reveal gap; warm List
has a 33.5ms reveal gap; cold Carousel has a 50.0ms moving gap; warm Carousel has
34.3ms moving and 33.5ms reveal gaps. The two stable List baselines do not turn
those failures into passes. Neither Carousel calibration is acceptance-eligible.

The motion-end to reveal-start intervals are 1.447s / 1.236s for cold/warm List
and 1.070s / 0.976s for cold/warm Carousel. Later recorded script work is 57.5ms
for cold List (11.1ms forced layout) and 55.7ms for cold Carousel (8.7ms forced
layout); the warm samples have no recorded post-reveal LongFrame. This does not
establish that optional work is free or attribute a timing improvement to the
new shortcut: this cohort neither holds High loading nor isolates that path.

Evidence: [complete analyzer output](../../../.artifacts/staged-performance-11873-960483f-v2-hero1440-synthetic-n1-analysis.json),
with all original measurements and calibration timestamps in the sibling
`staged-performance-11873-960483f-v2-hero1440-synthetic-n1` directory and the
runner log beside it. This is a revision-bound diagnostic, not a percentile
acceptance run. The general activation gate and physical-device checks remain open.

## Explicit Background output experiment protocol

Set `SPATIAL_PERFORMANCE_BACKGROUND_OUTPUT=1` to run the existing performance
harness with the additional `stage-background-output=1` query flag. Without that
environment setting, navigation and the default renderer path are unchanged.
The experiment adds `[background explicit-owner]` to test names and records
`backgroundOutputVariant` as `explicit-owner` in both reports and individual
samples; ordinary new runs record `default`. Keep the variants in separate
artifact directories and compare only matching runtime, build, viewport, input
and temperature cohorts.

The experiment records the owner once at source readiness and once after the
measurement probe has stopped. It performs no owner reads per animation frame
and adds no settling wait. Both snapshots must show an initialized explicit
owner, `implicitBackgroundTarget: false`, exactly one inventoried output target
and the same nonempty target ID across navigation. Missing diagnostics fail
validation. Validation failures remain in the complete sample set. The analyzer
rejects mixed, unknown or mismatched report/sample variant labels; historical
unlabelled data remains `legacy-unspecified` rather than being inferred as a
control run.

The `staged-performance-v2` protocol, calibration, raw latency/frame/resource
gates, twenty-sample default and trusted-input separation remain unchanged. This
section defines an experiment only; it records no measured performance outcome
and does not enable the renderer experiment or staged navigation by default.
