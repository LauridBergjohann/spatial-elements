# Frozen catalog capture reuse

The runtime change in **`68b62f3`** retains the resolved source geometry while
staged navigation has explicitly frozen that source. The selected handoff
geometry, panel projection and fade opacity continue to change. Reuse avoids
repeating the source capture; it does not skip the final composition or the
moving handoff draw.

This document records the isolated WebGPU comparison on **5 November 2026**:
Demo build **3058**, runtime **`68b62f3`**, proof run **46978**, **3/3 tests,
exit 0**. Proof commit **`bfaa660`** records the comparison fixture built into
Demo 3058 after the runtime change; `68b62f3` alone does not identify that
fixture. The subsequent
full unit run **16627** passed **1113 tests in 129 files**, exit 0. These results
do not establish Stage frame pacing, a first-frame improvement, or device
acceptance.

## Reuse boundary

`CatalogSpatialElementLayer.freezeStagedSource()` creates separate source keys
for the front and rear bands. The key is available only while that source is
frozen, outside preparation and without a warm-output override. Viewport,
environment, fog or interaction-theme changes invalidate reuse for that freeze.
Finishing the staged panel releases the frozen source.

`CatalogGeometryFade` also keys the capture by renderer, destination, canvas,
dimensions, coordinate system, tone mapping, exposure and color space. An
ordinary draw, warm draw, full/zero-opacity draw or disposed capture invalidates
the retained image. A successful first fractional-opacity draw creates the
capture; compatible subsequent draws reuse it. The cache therefore cannot
remove the first mandatory source capture.

The prior CPU diagnosis and the motivation for this bounded experiment remain
in [the first-frame profile](staged-first-frame-profile.md). Its sampled costs
are not measurements of this change's savings.

## Comparative fixture

The [proof route](../../../apps/tests/src/routes/proof/catalog-warm-output/proof.ts)
uses the actual catalog layer, GLB assets, environment, focus, handoff and panel
projection. The new `fade-reuse=control|candidate` query is separate from the
existing warm-output modes. Both runs use `warm-mode=scratch` and identical
input poses. The control forwards the production fade call without its optional
fifth, frozen-source argument; the candidate retains it. Without the new query,
the existing warm-output proof does not install this interception.

Each mode covers List, Frosted Carousel and Glass Carousel, with two actors per
source. Each source runs once initially and once after a real High GLB and HDR
draw plus a Low preparation draw into an independent multisampled target.
Each cycle presents four poses:

| Pose | Handoff progress | Exit opacity | Candidate source capture |
| --- | ---: | ---: | --- |
| `moving` | 0.25 | 0.50 | Required first capture |
| `moving-reuse` | 0.45 | 0.40 | Reused |
| `moving-after-warm` | 0.65 | 0.28 | Required recapture |
| `moving-reuse-again` | 0.85 | 0.16 | Reused |

Between the second and third poses, `renderForPreparation()` overwrites the
same real fade scratch through a separately allocated target. This makes the
recapture assertion an actual invalidation check. The artificial destination
is allocated before measured motion. Carousel summary transforms and the
retained Glass plane advance with the poses.

The [browser test](../../../tests/catalog-fade-reuse.e2e.ts) runs serially with
one worker at **960 × 640, DPR 1**. Each checkpoint follows a submitted-work
fence and two animation frames. The browser captures the held composition
before releasing that exact checkpoint ID; reading or releasing the checkpoint
does not render. The screenshot covers the full visible front-canvas bounds,
including the underlying rear canvas and DOM composition. Only the separate
diagnostic background preview and status text are hidden. It is not a raw
texture readback or a screenshot of the background preview.

## Observed pixels and work

There are **24 poses per mode**, producing **24 exact control/candidate image
pairs**. Every decoded RGBA comparison has maximum error **0**. Every candidate
image has RGB range **239**, above the nonblank threshold of 40. The six
initial-to-reuse movement witnesses have maximum pixel difference **183**,
above the required threshold of 10.

The `draws` field counts execution of the fractional-opacity source-capture
callback, not individual GPU draw calls. The control executes it once for all
24 poses. The candidate executes it for the 12 mandatory captures and skips it
for the 12 reuse poses. Queue submissions are independently counted by a
forwarding wrapper around `GPUQueue.submit`:

| Source | First/recapture submissions, both modes | Reuse submissions, control → candidate |
| --- | ---: | ---: |
| List | 13 | 13 → 10 |
| Frosted Carousel | 21 | 21 → 14 |
| Glass Carousel | 29 | 29 → 22 |

The same counts hold before and after High preparation. Across the measured
poses the control records **504 submissions**, the candidate **436**. These
counts describe submitted work, not GPU duration or presentation latency.

All **48 measured motion windows** have zero calls to the five observed create
APIs: `createRenderPipeline`, `createRenderPipelineAsync`, `createShaderModule`,
`createTexture` and `createBuffer`. Each window includes capture/projection,
update and draw through GPU completion. Setup, warm preparation, screenshots
and the intentional intervening warm draw are outside those windows. This is
not a claim of zero allocations throughout the fixture or of zero GPU memory
growth.

Both modes report empty page-error and GPU-error arrays. A validation error
scope spans the proof work and is popped after the final queue fence;
uncaptured GPU errors are also collected. The terminal artifacts additionally
record all six handoff captures and all six focus observations as accepted per
mode, with readiness established after the warm fence. Those latter values
were inspected in this run; the new comparison test does not independently
assert each existing warm-proof field.

## Evidence and limits

Local artifacts are under `.artifacts/catalog-fade-reuse-3058-68b62f3/`:

- Each mode's `fade-reuse.json` records phases, capture callbacks, submissions,
  create calls and error arrays; `terminal.json` preserves the complete result.
- Each mode contains 24 held PNGs. The third test writes
  `pixel-and-work-comparison.json` with all 24 comparisons and six movement
  witnesses.
- `.artifacts/catalog-fade-reuse-3058-68b62f3.log` records the three passing
  cases. The [dedicated config](../../../playwright.catalog-fade-reuse.config.ts)
  inherits the production-preview and single-worker setup.

On normal completion, the fixture restores the intercepted prototype/device
methods and disposes its layer, contexts, render targets, asset/environment
owners, canvases and renderer in `finally`. This code review is not a leak
measurement or a forced-disposal-failure test. GPU validation covers the proof
work, not a separately instrumented teardown lifetime matrix.

The movement witness compares the whole composition. It establishes that the
candidate images change between poses, but does not isolate a Glass-only
region or independently measure each moving feature. Exact control/candidate
comparisons establish parity for the tested complete compositions. The High
intervention uses real owners but does not reproduce the full Stage refinement
owner graph. Arbitrary custom callbacks, transmission materials, repeated
resize/reprepare pixel comparisons, device loss, other browsers and physical
mobile devices remain outside this proof.

## Subsequent Stage and timing evidence

The [separate Framework follow-up](verification-2026-11-05.md#follow-up-frozen-source-capture-build-3058--68b62f3)
records two later browser runs on the same Demo **3058** / Core **`68b62f3`**:
ordinary-output staged navigation **24/24**, run **1420**, exit 0; experimental
background output in the actual Stage **5/5**, run **59745**, exit 0. They add
functional integration evidence without turning the isolated capture comparison
into a complete Stage pixel or pacing matrix. Their artifacts remain separate
under `.artifacts/staged-production-3058-68b62f3` and
`.artifacts/background-output-stage-3058-68b62f3`.

The [separate default-output n=1 diagnostic](staged-performance.md#frozen-source-capture-follow-up-build-3058--68b62f3),
run **50252**, completes four start-latency cases with all twelve start gates
below 100 ms. Raw Moving passes **3/4**, Reveal **2/4**. Three internal **33.5 ms**
gaps exceed the unchanged 33.4 ms threshold, and cold-List calibration remains
unstable. All samples are retained; none is eligible for performance acceptance.
These sequential diagnostic results do not establish a causal speedup or a
first-frame saving from capture reuse.

No timing threshold is changed by this proof. Staged navigation and explicit
background output retain their existing opt-in/acceptance boundaries. Repeated
calibrated performance runs and physical-device checks remain necessary before
accepting frame pacing or enabling either experimental path generally.
