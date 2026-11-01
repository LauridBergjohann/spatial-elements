# Deferred scroll-target warmup candidate

Status: **Canvas-retention measurement corrected; offscreen-only revision
implemented; its DOM-screenshot/GPU acceptance pending**.
No measured speedup or pixel-parity claim follows from this source checkpoint.
This is a narrow follow-up to [the recorded cleanup/zoom audit](../../../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.md).

## Evidence and limit

The profiled cold Carousel trace for runtime `be72259`, demo build `36109`, has a
173.503 ms optional-zoom callback after reveal. Inclusive sampled costs are
`warmRenderTargetSets` 54.942 ms and `prepareZoomEffects` 116.965 ms;
`renderMinimapBlur` 107.754 ms is **inside** the latter, not additional cost.
These are approximately 1 ms CPU samples, not unprofiled acceptance measurements.

The current deferred path redraws both the inactive Scroll set and the active
Full set. The staged reveal previously warmed Full twice, including every panel
blur key. The final Full draw also repairs the visible canvas after the warmup's
Scroll-resolution draw. Simply deleting that final draw is incorrect.

The revised candidate only renders Scroll's offscreen scene and blur targets.
Then restoring Full's bindings needs no repeated Full draw. It removes one
complete warm draw in the eligible path; it does **not** remove all 54.942 ms or
the separate minimap work. `preparedZoomViews` already deduplicates successful
zoom preparation per minimap instance. No repeated minimap warmup is established
by this trace.

## Original masked-Canvas experiment and measurement correction

Run `38679`, demo build `28778` / runtime `eff4f75`, reported zero linear capture
and depth-witness errors at DPR 1 and 1.5, but Canvas2D-copy errors of **255** both
after warming and after a fence/two RAFs. First Scroll created no measured
shaders/pipelines/textures/buffers; following Scroll/Full outputs matched the
reference. The raw failure is retained, but **255 does not establish visible
Canvas loss caused by the warm draw**.

A separate Background-output positive control on the same build found a zero
RGB range in Canvas2D copies after fence/two RAFs even without a warm draw.
The earlier `before` pixels were read before an asynchronous GPU-readback wait;
`after` pixels were read afterwards. WebGPU drawing-buffer availability across
presentation is therefore a confounder. Two blank copies could also falsely
pass a retention comparison. Neither the failure nor a zero copy difference
is sufficient evidence of what the browser actually displays.

The original [pixel report](../../../.artifacts/deferred-scroll-warmup-28778-eff4f75/deferred-scroll-warmup.e2e-5d251-the-real-first-Scroll-frame-chrome/deferred-scroll-warmup-pixels.json)
and its trace remain unchanged. The earlier run on build `27554` had a fixture
port error (`container` was missing); it is also retained, not counted as pixel
evidence. Offscreen-only remains the chosen candidate because the installed
Three cache keys support reuse of the Full Canvas pipelines, and it performs
less work; it is not justified by an unproved visible-output regression.

The revised protocol is `offscreen-scroll-warmup-v3-dom-checkpoints`. Explicit
promises hold the fixture while Playwright captures the same Canvas locator.
The source screenshot must contain spatial RGB variation greater than 40. A
no-op fence/two-RAF checkpoint validates the measurement without any warm draw;
then screenshots after the actual warmup and another fence/two RAFs must match
the source exactly. Candidate and reference Scroll/Full outputs also use these
screenshots. Linear HalfFloat, depth and first-Scroll resource checks remain
separate and unchanged. No tolerance is increased; raw screenshots are saved.
PNG decoding/comparison happens in the Node test harness, not through any Canvas
draw. Checkpoints use monotonically increasing IDs: stale acknowledgements
cannot advance another phase, and route teardown rejects a pending wait. The
fixture never redraws or reseeds between source and retention checkpoints.

## Minimal runtime scope

Two new **internal** `StageRenderPipeline` methods are sufficient:

- `captureDeferredScrollWarmup(ownerIsCurrent): DeferredScrollWarmup | undefined` captures an
  opaque token immediately after the successful synchronous reveal warm draws,
  before their existing GPU fence. Stage only publishes it after that fence and
  the existing owner checks succeed. It allocates or retains no GPU resources.
- `warmInactiveScrollTargetSet(token): boolean` validates the token and performs
  one synchronous offscreen-only warmup. `false` means use the existing complete warmup;
  exceptions restore state and reach the existing optional-preparation warning.

The revised warmup calls neither the display quad nor `renderBackgroundPanels()`.
Stage needs one optional token
with its page/presentation identity snapshot. No public setting, new renderer,
new target, navigation wait, or scheduler is introduced. Initial/direct detail
binding and classic navigation retain their existing warmup path.

Code review required one additional internal `LiquidGlassPanel` ownership guard:
the constructor records its final mesh/material identities, material versions,
shader-node roots and callbacks. Replacing those objects/root nodes, changing a
material version, adding children or replacing callbacks rejects reuse of Full's
completed preparation;
normal rendering still accepts customization. This is not a recursive proof of
every internal TSL node: in-place mutation/monkey-patching inside an original
shader graph without a root or material-version change is outside this contract.
Ordinary uniform changes, including alpha, backdrop texture and visual size,
remain allowed. The pipeline also
checks its controlled Scene tree, callbacks and override material, draw hooks,
and in-place panel-runtime replacement. These checks run at token capture/use,
not on every visible frame. The query-gated target statistics expose
`inactiveScrollWarmups`, distinguishing actual shortcut use from normal warming.
The conservative original guards are retained in this revision; removing them
is not part of establishing the simpler output path.

The first candidate deliberately supports only a stable single representation:
Low without an active refinement blend, or completed High without a blend. It
does not wait for High. This includes the recorded cold Low-only case. An active
refinement uses the old path, avoiding an additional clock-neutral rendering API
or an accidental change to `q`, refinement completion, outline or picking owners.

## Guards and lifetime

The token is evidence of completed Full preparation, not a cached scene image.
Validate immediately before the synchronous warmup:

| Owner | Required identity / state | On change |
| --- | --- | --- |
| Stage | Same page-binding epoch; alive; staged reveal finished; no new handoff or outgoing background | Abort if obsolete; otherwise existing warmup |
| Presentation | Same hero/Low/High owners and environment references; no active refinement; detail media still 3D | Existing warmup; never delay High adoption |
| Pipeline | Same Full/Scroll target objects, display material/quad, blur-map entries and target sizes; Full active | Existing warmup |
| Output | Same Canvas target, viewport/drawing-buffer dimensions, DPR and render settings; no resize since token | Existing warmup |
| Panels | Same controlled runtime/minimap instances, material identities/versions and blur configuration; panel scene has no background | Existing warmup |
| Backend | Supported WebGPU Canvas path, ordinary output context and no XR/custom output override | Existing warmup |

Use a small pipeline configuration epoch for resize/recreation/blur-sync/output
changes rather than claiming that equal object identity proves unchanged size or
configuration. Conservative invalidation on a no-op resize is acceptable for
this first candidate. Stage can compare existing owner getters; no scene-wide
scan, serialized matrix key or new asset lease is needed. Unsupported/custom
panel material owners remain on the existing path.

Do not create the token from newly read identities only after the fence: a resize
during that await could otherwise certify targets which were never warmed. The
pre-fence snapshot is validated again at use, so that race rejects the shortcut.

New High adoption changes the presentation identity, so a token recorded while
Low was shown is rejected. High becoming ready in the preparation cache without
adoption does not change the live owner and need not invalidate it. JavaScript
cannot adopt High between validation and drawing when this job contains no
`await`. Consume the token once; clear it on release, cancellation, page
replacement or disposal. No callback from this work can later revive it.

## Offscreen-only warmup algorithm

1. Validate before mutation. Save active target selection, renderer state and
   auto-clear flags; use `try/finally` for every borrowed state.
2. Activate Scroll bindings. With scissor disabled, render its real offscreen
   scene capture and all its panel-blur targets. Normal offscreen clears remain
   necessary. This does not draw either canvas.
3. Do not draw any Canvas output. Full reveal already drew the same display and
   panel materials in their Canvas contexts. Scroll only changes their sampled
   texture values, not their node graphs or output formats.
4. Restore Full texture bindings and all borrowed renderer state in
   `finally`. Preserve the existing minimap-capture invalidation caused by
   switching target sets; never mark these pixel captures current. Continue the
   existing `prepareZoomEffects()` and final render request unchanged.

Neither `renderStageDisplay`, a direct display-quad draw, background panels nor
`warmRevealFrame` belongs in step 3. An unchanged linear attachment alone is
insufficient evidence of unchanged presented Canvas pixels; the new protocol
measures presentation independently.

### Installed Three 0.186.1 cache evidence

`RenderContexts.get()` keys attachments by count/format/type/MSAA/depth/stencil,
MRT and call depth, not texture dimensions. `RenderObjects.get()` reuses the
object/material/render-context/lights tuple; an ordinary camera reference update
does not create another object. `WebGPUBackend.needsRenderUpdate()` and its
pipeline cache key include output format, color space, samples, depth/stencil,
geometry and material raster/blend state, but not sampled texture identity or
dimensions. These values remain unchanged between the existing Full and Scroll
Canvas draws.

`TextureNode.value` changes a value without changing the node graph/version.
`NodeSampledTexture.update()` then changes its texture binding. Full and Scroll
scene captures are both linear HalfFloat 2D textures with the same filters; their
blur resolves also match in format/type/filter. The different sizes are runtime
texture dimensions, not shader definitions. Their **offscreen** blur nodes and
targets are separate owners and still need their real Scroll preparation.

The first actual Scroll Canvas draw can create a new **bind group** for the
different texture IDs (`Bindings._update` / `WebGPUBindingUtils.createBindings`),
while reusing its already prepared pipeline/layout. Existing resource gates
measure shaders, render pipelines, textures and buffers; they do not claim zero
bind-group work. No new Canvas pipeline is implied solely by Full-to-Scroll
texture replacement. New materials, lights/context, clipping, geometry, output
format/sample changes or late-visible objects could instead introduce one;
the retained guards and actual first-Scroll proof must cover this boundary.
This source analysis supports the revised experiment, not an accepted speedup.

## Acceptance before activation

- **CPU ownership:** eligible path draws exactly one Scroll scene and zero Full
  scenes and no Canvas draw or color/depth/stencil clear. All renderer flags, viewport,
  scissor, target selection, panel visibility and Full texture bindings restore
  after success and injected exceptions. Guard rejection performs no mutation.
- **Invalidation:** resize, DPR/blur changes, target replacement, High adoption,
  active refinement, new navigation, cancel and destroy reject the old token.
  Ready-but-unadopted High remains eligible. Direct-detail callers are unchanged.
- **GPU/DOM pixels:** seed the real output with nonuniform color and depth,
  capture its presented Canvas through an explicit Playwright checkpoint,
  execute the actual candidate method and compare before/after screenshots
  exactly. Check a no-op fence/two-RAF baseline and the same delay after warming,
  without a redraw/reseed. Use a subsequent
  depth-tested diagnostic draw to detect cleared depth. Include genuine Glass,
  Frosted and minimap-panel contexts, retained alpha, fractional DPR and resize
  rejection. No fixture reseeding may hide a warmup write.
- **Actual preparedness:** after candidate warmup, perform the real first Scroll
  frame and compare it with the existing path, through the same final output
  transform. Record new shaders/pipelines/targets; offscreen preparation must not leave
  these contexts cold. Verify the following Full frame and real zoom as well.
- **Measured effect:** rerun the same diagnostic and unprofiled cohort separately.
  Count removed passes and report optional-warm callback/long-task durations.
  Keep reveal gates, raw data and all later minimap/High costs unchanged. No
  speedup follows from pass counts alone.

Further division of minimap preparation is a separate proposal. Its source
capture, display conversion and downsample levels could become distinct jobs,
but Gaussian horizontal/vertical work is nested in Three's `updateBefore`.
Breaking private Three internals or merely delaying the same 107 ms call is
outside this candidate.

## Source-check evidence and pending browser runs

The focused Pipeline/Reveal/Zoom suites pass **76/76 tests in four files** after
the offscreen-only change. They now require zero Canvas draws and check cleanup
after both scene and blur failures. Core `tsc --noEmit` and the isolated GPU
fixture TypeScript check against current Core source pass, without rebuilding
packages or changing the currently tested `dist`. The earlier CPU checks did not
validate presented Canvas retention. The offscreen-only revision still requires
its corrected GPU/browser run; no previous passing pixel claim is carried forward.
The separate checkpoint-owner suite passes **3/3 tests** (acknowledgement order,
stale IDs, overlapping requests and teardown). The revised GPU fixture passes
its isolated TypeScript check; Playwright lists all three cases. These are
protocol/source checks, not GPU or screenshot acceptance.

```sh
npx playwright test --config playwright.deferred-scroll-warmup.config.ts --output .artifacts/deferred-scroll-warmup-<build>-<revision>
```

This config contains three cases:

1. The actual Pipeline API at DPR 1 and 1.5: exact linear HalfFloat and presented
   Canvas color preservation; eight acknowledged screenshot checkpoints per DPR
   (source, no-op delay, after warmup, retained, candidate/reference Scroll/Full);
   a depth-tested witness with an explicit cleared
   depth negative control; identical first Scroll/following Full outputs; no GPU
   resource creation during the first Scroll draw; resize rejection and state
   restoration. Candidate warming precedes the reference warmup. No reseeding
   hides a candidate write. The fixture includes real Glass and Glass-minimap
   camera contexts. Its empty Frosted runtime reflects the no-GPU-glass branch;
   it does not prove native CSS backdrop filtering or full minimap interaction.
2. Real List → Hero navigation, with High deliberately held for deterministic
   Low-only eligibility, checks exactly one additional `inactiveScrollWarmups` hit
   and then exercises real zoom/minimap rendering.
3. The same real navigation/zoom check from Carousel.

The two intentionally held-High cases establish functional eligibility only.
They do not modify existing performance cohorts or stand in for natural cold/warm
latency measurements. The strict pixel thresholds are zero, without a new
tolerance allowance. Browser failures and their artifacts must be retained.
