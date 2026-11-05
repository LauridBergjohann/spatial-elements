# Staged navigation: first-frame CPU diagnostic

Run **12485** completed one cold Carousel navigation on the unchanged Demo build
**84797 / Core `ceeef8f`**, default Background output. It passed the harness
execution (1/1, exit 0). This is a **profiled n=1 diagnostic**, not performance
acceptance, a percentile estimate, or evidence of an optimization's effect.
The raw frame gates and calibration protocol remain unchanged.

The local artifacts are in
`.artifacts/staged-performance-84797-ceeef8f-default-carousel-cold-profile/staged-performance.e2e.ts--87364-data-and-module-navigations-chrome/`:

- `cpu-0.json`: CDP profile, clock metrics and transition markers.
- `measurements.json` and `samples.json`: the existing harness observations.
- `first-frame-analysis.json`: offline clock conversion, disjoint windows,
  inclusive stacks, sample points and manually verified bundle references.

The offline helper is `.artifacts/analyze-first-frame-profile.mjs`. No runtime
instrumentation or rebuilt application was introduced for this diagnosis.

## Clock and sampling limits

CPU sample times are converted into document milliseconds using
`(profile.startTime + cumulative timeDeltas) / 1000 - NavigationStart * 1000`.
Here `NavigationStart` is **4648.549698 seconds** and `profile.startTime` is
**4656033770 microseconds**. The recorded `profileStart` evaluation occurs
**4.356 ms after** the preceding metrics timestamp; treating these separate
CDP responses as simultaneous would shift every attributed sample.

There are 2194 samples and no negative deltas. Excluding the initial profiler
startup delta of 256.233 ms, observed intervals have median **1.646 ms**, p95
**2.412 ms**, maximum **39.281 ms**. Around the first-frame boundary their
median is **1.622 ms**, maximum **4.401 ms**. Sampling is therefore not an exact
1 ms stopwatch. The harness does not explicitly set the sampling interval.

The analysis assigns each observed stack to the following sample interval,
clips that interval to the marker window, and includes any carry-in interval.
These weights are approximate attribution, not measured function durations,
guaranteed savings or CPU lower bounds. Carry-in attribution can extend a stack
across a marker even when that function has already returned. Inclusive stack
weights overlap and must not be added. The initial startup interval is never
assigned to the first stack.

## First synchronous submission

| Instrumented interval | Exact marker duration | Observed sample points |
| --- | ---: | ---: |
| Click → adapter entry | 31.7 ms | 19 |
| Entry → captured | 4.5 ms | 3 |
| Captured → prepared | 7.6 ms | 4 |
| Prepared → first motion | 4.6 ms | 2 |
| First motion → first submitted | 20.1 ms | 12 |

Entry is at **8011.6 ms**, capture at **8016.1**, prepared at **8023.7**, first
motion at **8028.3**, first submission at **8048.4**. Entry to first motion is
16.7 ms; click to first submission is 68.5 ms. Submission denotes the end of
the synchronous flush; it does not establish GPU completion or presentation.

Pre-motion stacks include summary retention/projection, `beginStagedDetailMotion`,
source-DOM setup and the exit-opacity snapshot. Their small sample counts do
not support precise cost estimates for individual reads or writes. The first
render stack follows the Kit navigation callback through
`startStagedCatalogNavigation` → `StagedCatalogTransition.start` → frame hook →
`flushCatalogFrame` → Stage/Pipeline `renderFrame`.

| Disjoint first-submission group | Approximate weight | Sample points |
| --- | ---: | ---: |
| `renderCarouselRear` | 13.761 ms | 8 |
| `renderForegroundLayer` | 2.829 ms | 2 |
| `clearBackgroundOutput` | 1.738 ms | 1 |
| Other work / boundary attribution | 1.772 ms | 1 |

Within the Rear group, **7.265 ms / 4 points** include `CatalogGeometryFade.render`,
and **5.254 ms / 3 points** include `CatalogDepthBlur.renderCapture`. The latter
contains source capture and Gaussian `updateBefore` work. Cached ground resolve,
glass rendering, bindings and submission also appear. These nested numbers are
parts of the Rear total, not additional costs.

The following Moving interval, **8048.4–8443.9 ms**, lasts 395.5 ms and contains
181 samples. Its approximate weights include Rear **104.538 ms / 43 points**,
Foreground **49.902 ms / 23**, Background clear **37.352 ms / 12**. Nested within
Rear, GeometryFade accounts for **25.589 ms / 11** and actor DepthBlur for
**24.147 ms / 10**. Idle/program samples, browser/test work and remaining
transition work occupy the rest. These are cumulative window weights, not
per-frame costs. Work after `motionEnded`, including later binding-related
long frames, is outside this window.

No data-loading/module-evaluation stack was sampled inside the first synchronous
flush. Network responses finish during that interval, which alone says nothing
about when their JavaScript runs. The pre-click source was idle. The earlier
unprofiled 53.9 ms timer/49.9 ms frame gap is a different run and must not be
retrospectively assigned this profile's stacks.

## Bounded next experiment

Rear work is the stronger first-frame candidate than the isolated transparent
Background clear. Freezing the whole Rear Canvas is incorrect: it also contains
the selected glass panel, whose matrix changes during motion, and the backdrop
changes as the outgoing scene fades. DOM opacity on that Canvas would freeze or
fade the retained panel incorrectly.

The smaller follow-up is to reuse the **existing GeometryFade capture** while
the source is explicitly frozen and the same capture generation/band remains
valid. The outgoing actor transforms, blur and authored material opacity stay
fixed; exit opacity is applied after capture by the fade quad. Ground/shadows
are drawn separately, and the moving handoff model remains in the Foreground
pass. Glass composition and its changing backdrop must continue to render.

The shared capture is also used by Front and preparation draws. Any overwrite,
generation/lifecycle change, resize, relevant source change or failed capture
must revoke reuse before another draw. An ordinary draw or a different band
must not leave an optimistic cache hit. No extra texture or warm-up capture is
justified by this profile. A mixed Front/Rear scene may have no reusable hit.

This experiment can reduce repeated capture/defocus work **after** the first
Moving frame. It does not establish a faster first submission and cannot save
the entire Rear weight. Acceptance requires pixel equivalence, unchanged opaque
occlusion and moving glass/handoff, lifecycle and scratch-overwrite coverage,
then separate unprofiled pacing measurements. The transparent Background cache
is deferred; external legacy preparation writes make a global clear-state cache
unsafe without explicit invalidation at every publication boundary.
