# Isolated Background-layer output proof

Status: the first GPU execution completed on demo build 10026 / proof revision 7d373ab and exposed two fixture assumptions. Protocol v2 corrects them but has **not yet been rebuilt or browser-tested**. This is still an experiment, not an accepted production rendering change. No production rendering path selects its candidate.

The experiment asks whether the existing opaque Background canvas can accumulate its ordered linear draws in one explicit target, then perform the output transform once. It does not combine the Background, Foreground or Carousel Rear layers, change glass sampling sources, cache model pixels, or batch GPU submissions.

## Reference and candidate

The route `/proof/background-layer-output` uses the actual `StageRenderPipeline` and `LiquidGlassPanel` implementations. A nonuniform HDR scene capture and the pipeline's separate blur captures are prepared once per size. Both paths read those same textures. One regular glass panel uses the stage camera; an overlapping minimap glass panel uses its own off-axis camera. Their depth clears and rendering order come from the unchanged `renderBackgroundPanels()` method. Small depth-tested witnesses inside those groups make the depth-clear ordering observable.

The reference calls `renderStageDisplay()` and `renderBackgroundPanels()` on a CanvasTarget. The candidate draws the same linear stage-display quad and the same panel sequence into a separate RGBA16F target with four MSAA samples and depth. A public Three `RenderPipeline` samples that target with `screenUV` and applies the final output transformation. The target is never a glass input, so the experiment introduces no read/write feedback with `sceneCapture` or its blur textures.

The final transformation remains Three's `RenderOutputNode`: unpremultiply, tone mapping, output color conversion, then premultiply. The candidate does not convert intermediate results to eight-bit color or mix already tone-mapped images. Its public renderer state is restored in `finally`, including canvas/targets, viewport/scissor, clear values, automatic-clear flags, tone mapping, exposure, output color space and XR enablement.

Frosted panels have a native CSS surface in this framework, not a GPU Frosted material. The fixture therefore also renders two actual Svelte `Panel surface="frosted"` components over the resulting canvases. A minimal registration context avoids instantiating an unrelated second Stage renderer. The final DOM screenshots test the real backdrop-filter, tint, rounded surface and text. No substitute Frosted shader is introduced.

## Linear readback and output comparison

The linear comparison uses public `copyFramebufferToTexture`, `copyTextureToTexture` and `readRenderTargetPixelsAsync` APIs with a HalfFloat readback attachment. In the installed Three r186 source, a framebuffer copy outside a render call uses the explicitly bound target or, for a Canvas, its current linear intermediate. The reference's copy therefore observes the linear framebuffer after the ordered panel draws; the candidate's copy observes its explicit linear target. The experiment requires HDR values above one to remain present and compares decoded half-float channels exactly.

Three's WebGPU `copyTextureToBuffer()` returns mapped data with 256-byte row alignment; it does not repack the rows. Protocol v2 validates the exact buffer length `(height - 1) × alignedRowBytes + width × 8`, then extracts exactly `width × height × 4` HalfFloat channels. At 300 × 216 physical pixels, each 2400-byte row has a 2560-byte stride, and the returned 276400 values include 17200 padding values. Padding is never interpreted as pixel alpha. A separately cleared HDR attachment with distinct exact RGBA values `[0.25, 0.5, 2, 1]` verifies the complete copy/readback chain at both physical sizes, independently from reference/candidate agreement. Pure decoder tests poison padding and use different values for every row/channel.

An opaque Background canvas does not imply that its linear intermediate alpha is always one. Real `LiquidGlassPanel` uses additive blending for its sheen; Three's WebGPU additive alpha factors are One/One. Thus linear alpha may exceed one before `RenderOutputNode` clamps it. Protocol v2 retains exact four-channel reference comparison, records both paths' alpha extrema, and requires alpha one only when the panels are hidden. No pixel tolerance is widened.

`Scene.onAfterRender` is not used as a supposed pre-output hook: in this Three version it is invoked **after** `_renderOutput`. No private renderer field is read or mutated to obtain the linear image. Access to the existing WebGPU device is confined to the diagnostic submit counter, error scopes and queue fence. The counter immediately forwards the same command buffers to the original `GPUQueue.submit`; it never delays or combines submissions.

Canvas output is copied synchronously into a 2D canvas and compared independently from the linear data. The actual Frosted DOM surfaces receive a third, separate screenshot comparison. All three comparisons initially require exact equality; a failure must be diagnosed rather than silently widening the tolerance.

## Cases and boundaries

The eighteen rows cover six output configurations at panel opacities zero, one quarter and one:

- Initial and repeated output at 160 × 120 CSS pixels, DPR 1.
- Resize to 200 × 144 CSS pixels, DPR 1.5, including sharp and blurred backdrop targets at their production densities.
- A partial viewport, active scissor and nonstandard clear depth. These three deliberately use the unchanged Canvas path for the candidate as conservative fallbacks. Their equality does **not** establish that the new explicit-target path supports those configurations.

Before each output, a magenta near-plane seed poisons existing color/depth so a missing clear is observable. Each exact rendering configuration is warmed and fenced before its measured repetition. The reported count covers only the ordered output sequence, excluding the seed, warmup and readback.

For the eligible full-viewport cases with visible regular and minimap panels, the hypothesis is four fewer submissions: the reference performs four intermediate Canvas output transforms after the two depth clears and two panel draws; the candidate keeps those linear passes but performs the output transform once at the end. With no visible panels, the candidate should not claim a saving. Fallback counts must match. These are proposed assertions, not measured results or a frame-time claim.

A deliberate exception after the candidate's panel draws checks renderer-state restoration and a subsequent successful redraw. The test also records WebGPU validation/uncaptured errors and browser errors. Targets, textures, materials and the renderer remain owned by the fixture until its DOM comparison completes, then are disposed when the route unmounts.

The scope is an opaque Background canvas. The stage-display fragment already forces alpha one; panel opacity is varied, but this proves no transparent-layer composition, Foreground/Rear output, custom nested renderer callback, arbitrary GLTF transmission context, or production readiness behavior. A future integration would need its own resource lifetime, idle warmup, resize/cancel and memory review.

## Memory accounting

The JSON reports the explicit target's physical size and logical attachment budget separately: 8 bytes per pixel for resolved RGBA16F, 32 bytes for four-sample color, and 16 bytes for four-sample Depth32. This is approximately 76.9 MiB at 1440 × 1000 physical pixels, before optional depth resolve and driver overhead; doubling both dimensions multiplies that budget by four.

The proof intentionally retains both paths, so its target is additional memory. It does not claim that the existing internal Canvas framebuffer is reused or released. The shared scene/blur sources, readback targets and other proof resources are outside this stated candidate budget. A production design would have to measure any replacement versus addition explicitly.

## Execution and evidence

After a coordinated package/demo build, the isolated command is:

```powershell
npx.cmd --no-install playwright test --config playwright.background-layer-output.config.ts
```

The config owns port 4205 and writes `.artifacts/background-layer-output`. The test saves the complete row JSON before asserting pixel/count results, plus both Frosted PNGs and their channel comparison.

Preparation checks on 2026-11-01: `npm run check --workspace @spatial-elements/demo-sveltekit` completed with zero errors and zero warnings; `playwright test --config playwright.background-layer-output.config.ts --list` loaded exactly one test.

The first run's complete raw JSON and trace remain under `.artifacts/background-layer-output-10026-7d373ab`. All 18 rows reported exact agreement for both complete readback arrays and Canvas output, with no GPU validation/browser errors and restored state. Eligible visible-panel cases submitted 10→6 passes, hidden-panel cases 2→2, conservative fallbacks 4→4 or 12→12. The runner nevertheless exited 1 because the extra `linearAlpha === 1` assertion was invalid for real additive glass. The Frosted DOM comparison was not reached. DPR 1.5 statistics also included readback padding in that first run; those extrema are not valid pixel-only extrema and are preserved as failed-protocol evidence, not reclassified as a passing test.

The v2 decoder's three CPU cases pass, the demo typecheck again reports zero errors and zero warnings, and the Playwright listing loads the single test. The independent GPU readback controls and corrected material invariant still need a fresh coordinated build and GPU run. Exact linear, Canvas and Frosted DOM comparison limits remain zero.

## Preliminary integration decision

The measured ordered-output count supports investigating a Background-only integration after the complete corrected pixel/DOM proof passes: four saved submissions per frame with the two glass passes, without moving glass sampling, model rendering or depth clears. It proves no frame-time benefit; that requires a separate unprofiled comparison.

Memory is the decisive integration constraint. A full-size explicit target must replace the implicit Background framebuffer rather than silently coexist with it. In the installed Three version, a Canvas `clear()` or draw under ACES/sRGB may allocate that implicit framebuffer. Current `renderFrame(contentOnly)`, `freezeBackground()`, `warmRenderTargetSets()` and `warmRevealFrame()` all contain such Background paths; replacing only the ordinary detail-frame output would therefore retain both allocations. There is no public API for borrowing or retiring one private intermediate while keeping its owner unchanged. The safe design must cover the Background layer from its first clear onward, including warmup, outgoing snapshot and content-only clear, or explicitly abandon and dispose the candidate when a conservative fallback is chosen. The existing sceneCapture and blur targets remain separate. Initialization, ownership, warmup readiness, fallback lifetime, resize and total attachment memory require review before production code is authorized.
