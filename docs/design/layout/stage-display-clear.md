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
