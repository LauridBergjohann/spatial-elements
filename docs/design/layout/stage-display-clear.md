# Stage display clear and fullscreen copy

`StageRenderPipeline.renderStageDisplay()` has one controlled opaque fullscreen
quad. Its material samples the linear scene capture and, when enabled, the fused
outline mask. It has no nested scene rendering, no blending, and no depth test or
depth writes. Three applies the Canvas output transform after this draw.

For the ordinary full-viewport WebGPU Canvas output, clearing now belongs to that
quad's render pass. Previously `Renderer.clear()` submitted a separate clear and
also called `_renderOutput()` for the Canvas intermediate before the fullscreen
copy performed its own output transform. The shader and final output transform
are unchanged. This is a reduction in scheduled work, not a measured latency claim.

The combined path requires the WebGPU backend, no presenting XR session, no
stencil/reversed depth, clear depth 1 and clear stencil 0, no alternate output
target or MRT, no scissor, and a positive full Canvas viewport. Viewport and size
are compared in logical units so fractional DPR remains eligible. All other
configurations retain the previous explicit clear followed by the quad draw.
These are conservative scope restrictions, not claims of bugs in Three: its
`RenderContexts.get()` initializes the actual depth/stencil clear values.

All four `autoClear` flags are saved, forced true for this draw, and restored in a
`finally` block. Explicit clearing previously ignored the caller's individual
clear flags; simply inheriting those flags would change behavior. Existing
target selection and white opaque clear-color side effects are preserved. No
other clear call changes, including the zero-scissor reveal warm-up, foreground,
panel blur, scene contents, or generic depth helpers.

## Verification

- The targeted pipeline suites pass 50 tests, including every caller clear-flag
  combination, restoration on exceptions, conservative fallbacks, and fractional
  DPR. Core TypeScript checking passes.
- `/proof/stage-display-clear` and `tests/stage-display-clear.e2e.ts` compare the
  actual old and new StageDisplay paths on separate Canvas targets. The declared
  criterion is exact equality for both the linear half-float intermediate and
  the ACES/sRGB Canvas pixels. Cases include first use, repetition, resize/DPR,
  fused outline off/on, stale prior depth followed by a depth-tested translucent
  panel, and clipped/nonstandard-depth fallbacks. Nonuniform pixels and the
  visible panel contribution prevent a blank-output false positive. Submission
  counts are recorded for the isolated display call; no timing is inferred.
- The browser proof and a new production trace remain pending. Successful proof
  data must be persisted as `stage-display-clear-pixels.json`; unit mocks alone
  do not establish pixel equivalence or user-visible performance.

### Initial resize-fixture failure

The first GPU run on build `1782` / `8873f41` failed validation. Its unchanged
artifact directory is `.artifacts/stage-display-clear-1782-8873f41`. Before resize,
the eight comparisons were exact; all linear comparisons stayed exact. From the
resize onward the Canvas comparison differed by 255 and validation reported a
96×64 depth attachment beside a 171×120 color attachment. This failed run does not
establish successful pixel equivalence after resize.

The fixture resized both `CanvasTarget`s directly while only the candidate was
selected. Three's `Renderer.setCanvasTarget()` attaches its resize listener only
to the selected target; `_onCanvasTargetResize()` invalidates that target's cached
WebGPU descriptor through `backend.updateSize()`. The inactive control therefore
retained its old depth view. Its poison `renderer.clear()` was the first Canvas
output after resize, before the StageDisplay call being compared. The candidate
received the resize event, matching the asymmetric output in the artifact.

The corrected fixture follows the existing production
`StageRenderPipeline.resizeCanvasTarget()` sequence: select each target, then
call `renderer.setPixelRatio()` and `renderer.setSize()`. No runtime change was
needed. Additional labeled validation scopes distinguish control/candidate,
poison clear/draw, StageDisplay and following panel without yielding between draw
and Canvas snapshot. The original exact-pixel and empty-validation assertions
remain unchanged; the corrected GPU run is still pending.
