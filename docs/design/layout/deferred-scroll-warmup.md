# Deferred scroll-target warmup candidate

Status: **implemented; CPU checks pass; GPU/browser acceptance pending**.
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

The candidate instead warms Scroll without changing visible canvas attachments.
Then restoring Full's bindings needs no repeated Full draw. It removes one
complete warm draw in the eligible path; it does **not** remove all 54.942 ms or
the separate minimap work. `preparedZoomViews` already deduplicates successful
zoom preparation per minimap instance. No repeated minimap warmup is established
by this trace.

## Minimal runtime scope

Two new **internal** `StageRenderPipeline` methods are sufficient:

- `captureDeferredScrollWarmup(ownerIsCurrent): DeferredScrollWarmup | undefined` captures an
  opaque token immediately after the successful synchronous reveal warm draws,
  before their existing GPU fence. Stage only publishes it after that fence and
  the existing owner checks succeed. It allocates or retains no GPU resources.
- `warmInactiveScrollTargetSet(token): boolean` validates the token and performs
  one synchronous masked warmup. `false` means use the existing complete warmup;
  exceptions restore state and reach the existing optional-preparation warning.

The existing `renderBackgroundPanels()` has an internal no-depth-clear mode
whose default preserves every current caller. Stage needs one optional token
with its page/presentation identity snapshot. No public setting, new renderer,
new target, navigation wait, or scheduler is introduced. Initial/direct detail
binding and classic navigation retain their existing warmup path.

Code review required one additional internal `LiquidGlassPanel` ownership guard:
the constructor records its final mesh/material identities, material versions,
shader-node roots and callbacks. Customized public groups/graphs remain supported
by normal rendering, but are ineligible for masked warming. The pipeline also
checks its controlled Scene tree, callbacks and override material, draw hooks,
and in-place panel-runtime replacement. These checks run at token capture/use,
not on every visible frame. The query-gated target statistics expose
`maskedScrollWarmups`, distinguishing actual shortcut use from normal warming.

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

## Masked warmup algorithm

1. Validate before mutation. Save active target selection, renderer state and
   auto-clear flags; use `try/finally` for every borrowed state.
2. Activate Scroll bindings. With scissor disabled, render its real offscreen
   scene capture and all its panel-blur targets. Normal offscreen clears remain
   necessary. This does not draw either canvas.
3. Select the existing background Canvas target, set render target to `null`,
   scissor to `(0, 0, 0, 0)`, scissor test on and `autoClear=false`. Draw the
   existing display quad **directly**, then the controlled background panels in
   their real regular/minimap camera contexts with depth-clears disabled.
4. Restore Full texture bindings and all borrowed renderer/visibility state in
   `finally`. Preserve the existing minimap-capture invalidation caused by
   switching target sets; never mark these pixel captures current. Continue the
   existing `prepareZoomEffects()` and final render request unchanged.

Do not call `renderStageDisplay()` in step 3: its new eligible path clears
attachments, and its fallback explicitly clears. Do not reuse `warmRevealFrame`
unchanged: it also draws the minimap and calls Canvas depth-clears. A zero scissor
does not make an attachment clear harmless.

Installed Three's final output-transform draw retains the Canvas scissor and
sets `autoClear=false`. The masked draws should therefore prepare their real
Canvas-context pipelines without writing color or depth, including the final
color transform. This is a source-supported expectation requiring the GPU proof
below, not an accepted pixel guarantee. Pipeline preparation with zero fragments
must also be demonstrated, not inferred from a method having returned.

## Acceptance before activation

- **CPU ownership:** eligible path draws exactly one Scroll scene and zero Full
  scenes; no Canvas color/depth/stencil clear. All renderer flags, viewport,
  scissor, target selection, panel visibility and Full texture bindings restore
  after success and injected exceptions. Guard rejection performs no mutation.
- **Invalidation:** resize, DPR/blur changes, target replacement, High adoption,
  active refinement, new navigation, cancel and destroy reject the old token.
  Ready-but-unadopted High remains eligible. Direct-detail callers are unchanged.
- **GPU pixels:** seed the real output with nonuniform color and depth, execute
  the actual candidate method and compare both before/after. Use a subsequent
  depth-tested diagnostic draw to detect cleared depth. Include genuine Glass,
  Frosted and minimap-panel contexts, retained alpha, fractional DPR and resize
  rejection. No fixture reseeding may hide a warmup write.
- **Actual preparedness:** after candidate warmup, perform the real first Scroll
  frame and compare it with the existing path, through the same final output
  transform. Record new shaders/pipelines/targets; masked draws must not leave
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

The focused Pipeline/Reveal/Zoom suites pass **76/76 tests in four files**. Core
`tsc --noEmit` passes. An isolated TypeScript check of the new GPU fixture against
the current Core source also passes, without rebuilding packages or changing
the currently tested `dist`. No browser or GPU proof has run for this candidate.

```sh
npx playwright test --config playwright.deferred-scroll-warmup.config.ts --output .artifacts/deferred-scroll-warmup-<build>-<revision>
```

This config contains three cases:

1. The actual Pipeline API at DPR 1 and 1.5: exact linear HalfFloat and final
   Canvas color preservation; a depth-tested witness with an explicit cleared
   depth negative control; identical first Scroll/following Full outputs; no GPU
   resource creation during the first Scroll draw; resize rejection and state
   restoration. Candidate warming precedes the reference warmup. No reseeding
   hides a candidate write. The fixture includes real Glass and Glass-minimap
   camera contexts. Its empty Frosted runtime reflects the no-GPU-glass branch;
   it does not prove native CSS backdrop filtering or full minimap interaction.
2. Real List → Hero navigation, with High deliberately held for deterministic
   Low-only eligibility, checks exactly one additional `maskedScrollWarmups` hit
   and then exercises real zoom/minimap rendering.
3. The same real navigation/zoom check from Carousel.

The two intentionally held-High cases establish functional eligibility only.
They do not modify existing performance cohorts or stand in for natural cold/warm
latency measurements. The strict pixel thresholds are zero, without a new
tolerance allowance. Browser failures and their artifacts must be retained.
