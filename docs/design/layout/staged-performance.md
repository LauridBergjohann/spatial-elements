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
and visibility restoration, and rejected readiness on failure. **The follow-up browser
proof of this winding preparation is still pending; this section claims no measured
latency or pacing improvement from that change.**
