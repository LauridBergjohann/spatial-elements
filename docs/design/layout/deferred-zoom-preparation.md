# Deferred zoom preparation: bounded-work design audit

Status: **read-only audit and proposed follow-up; not implemented**. This is
separate from the [offscreen Scroll warmup](deferred-scroll-warmup.md). No new
timing result, speedup, quality change or activation follows from this note.

## Evidence and current source

The profiled cold Carousel trace for runtime `be72259`, demo build `36109`,
contains a 173.503 ms optional-zoom callback after reveal. Its sampled inclusive
costs are `warmRenderTargetSets` 54.942 ms and `prepareZoomEffects` 116.965 ms.
`renderMinimapBlur` 107.754 ms is **inside** the latter, not an additional cost.
See the preserved [trace audit](../../../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.md)
and [machine-readable windows](../../../.artifacts/staged-gpu-trace-36109-be72259-carousel-cold/cleanup-zoom-audit.json).
These are approximately 1 ms CPU samples, not unprofiled acceptance timings.
The trace does not attribute the 107.754 ms to individual blur subpasses.

The source audit uses the `960483f` runtime and installed Three `0.186.1`:

- `StageExperience.scheduleZoomPreparation()` already waits through two RAFs
  after the transition and checks the page-binding owner before starting work.
  It warms Scroll resources, awaits `prepareZoomEffects()`, then requests a
  normal frame only for the current page.
- `StageRenderPipeline.prepareZoomEffects()` skips successfully prepared
  minimap instances using a WeakSet. For each remaining view it draws the blur
  capture, optionally captures its Glass panel, then starts two foreground-scene
  compilations with the rest/foreground ring materials. It waits for those
  promises and the GPU queue before marking views prepared.
- Preparation deliberately leaves capture-valid flags unchanged: the first
  visible zoom must capture the current pose. Existing successful preparation
  is not evidence that cached warm pixels are suitable for live display.

No repeated successful minimap warmup is established by this trace. Adding
another delay before the whole function would merely move the same long task.

## Real work units and their limits

`MinimapController.renderMinimapBlur()` currently submits these ordered units:

1. Size the targets, clear the transparent context target and render the isolated
   source model with its capture camera.
2. Clear the display target and draw the existing display-conversion quad.
3. Run `MinimapBlurPipeline.render()`: update the blur direction, draw each
   existing downsample level, then draw the final resolve.

The downsample pyramid contains one to five levels for a positive radius; the
zero-radius case has no downsample levels. Each level is an independently owned
RenderTarget/material/quad. The final resolve invokes Three's
`GaussianBlurNode.updateBefore()`, which draws both horizontal and vertical
passes synchronously before returning to the resolve draw. Those two passes
share Three-owned renderer state and a module-level quad. There is no supported
yield point between them; splitting them would require a different blur owner
or changes to private Three implementation, outside this narrow proposal.

Source capture, display conversion, each downsample level, final Gaussian/resolve,
optional Glass capture and foreground compilation are therefore genuine
candidate job boundaries. Each synchronous job must restore its borrowed
renderer/visibility state before yielding. Existing target pixels can bridge
the jobs, but a resize, view replacement or an intervening live capture must
invalidate the partial preparation before it is called complete.

This bounds the amount of submitted work per job, **not its elapsed time**. A
cold source-model shader or Gaussian shader build can still block one job.
Separating jobs does not eliminate their total cost or justify lowering blur
quality, resolution, sampling or pixel thresholds.

## Concurrent foreground compilation

The current loop invokes `compileAsync(minimapScene, screenCamera)` twice before
awaiting either result; only `overlayRing.material` differs. Thus both calls
collect the common model and overlay as well as their respective ring variant.

For an initialized renderer, Three synchronously collects object, material,
camera and render-context references before the first asynchronous build
(`Renderer.compileAsync`, including `_createObjectPipeline`). It is therefore
correct for the caller to restore the temporary ring material, visibility and
frustum-culling state immediately after each invocation. Keeping those borrowed
states active across `await` would instead expose hidden preparation state to
normal frames. Stage has already initialized the renderer in these paths; the
earlier `await init()` branch is not the normal contract here.

Three's `NodeManager.getForRender(..., true)` publishes a new builder state only
after `buildAsync()` completes. That path does not store an in-flight builder
promise for another `compileAsync` call to reuse. Concurrent cold compilations
can consequently repeat builder work for common objects. This is a source-level
redundancy candidate; it has not been isolated in the trace and must not be
presented as the cause of the entire 107.754 ms blur cost.

A narrow candidate is to await the first compilation outside all temporary-state
wrappers, recheck ownership, then compile only the second ring object with the
same target scene via the public `compileAsync(object, camera, targetScene)`
signature. The target scene is necessary to retain the same scene/light/cache
context. The first invocation can still prepare the common foreground content.
Actual first-zoom resource readiness must prove that this narrower second call
preserves both depth/material variants.

## Owner lifetime across asynchronous work

The current final check only tests pipeline disposal before adding the original
views to `preparedZoomViews`. A page change can instead dispose a particular
view while the Stage/Pipeline remains alive. `MinimapController.disposeMinimap()`
removes its nodes and disposes capture/blur targets, materials and geometry.
The already-started Three compilation still holds references to those objects
and resumes after asynchronous builder/pipeline work. Checking the current page
only after `prepareZoomEffects()` returns does not protect that interval.

This is a concrete missing ownership condition, not an observed browser crash
or a measured leak in the cited trace. Three's public compilation API has no
abort parameter; an owner check cannot retroactively cancel a started compile.
A safe change therefore needs both:

- Current view/target/configuration identity checks before every new job and
  after awaits, plus one unambiguous in-flight preparation owner per view.
- A bounded resource lease for a compilation already in flight, or another
  explicit disposal contract that retains its inputs until settlement. An
  obsolete job may finish releasing its inputs but must never start later work
  or mark an old view prepared.

The lease must cover actual owner disposal, not only the final WeakSet write.
Failures must release it exactly once and remain reportable. Direct-detail
binding, a user requesting zoom before optional preparation completes, page
replacement, cancellation and Stage destruction must retain their existing live
rendering/fallback behavior.

## Smallest next investigation

Before adding a scheduler or splitting the blur implementation:

1. Reproduce the missing lifetime boundary with a deferred compilation fixture:
   dispose/replace a minimap while compilation is pending and verify which
   resources a continuation still touches. Verify immediate restoration of
   ring material, visibility, frustum flags and renderer state separately.
2. Specify an in-flight owner/lease contract and compare serial whole-scene
   compilation with a serial ring-only second compile. Test simultaneous
   preparation requests, rejection/retry, supersession and exactly-once release.
3. Use the real renderer to verify both ring variants and the first zoom frame,
   including Glass/Frosted composition, with no late shader/target creation or
   changed pixels. Do not hold temporary scene state while awaiting compilation.
4. Obtain a new revision-bound breakdown of source capture, display conversion,
   downsample and Gaussian/resolve costs. Only then decide whether explicit
   pass jobs would reduce the maximum task enough to justify their added owner
   and invalidation machinery.

All future measurements must retain reveal gates and report optional preparation,
later High work and first-input responsiveness separately. A smaller callback
obtained by moving work is not a reduction in total rendering cost.
