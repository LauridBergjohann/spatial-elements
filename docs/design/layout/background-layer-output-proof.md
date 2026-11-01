# Isolated Background-layer output proof

Status: fixture prepared and type-checked; **not built or browser-tested yet**. This document records the proposed experiment, not a successful pixel or performance result. No production rendering path selects its candidate.

The experiment asks whether the existing opaque Background canvas can accumulate its ordered linear draws in one explicit target, then perform the output transform once. It does not combine the Background, Foreground or Carousel Rear layers, change glass sampling sources, cache model pixels, or batch GPU submissions.

## Reference and candidate

The route `/proof/background-layer-output` uses the actual `StageRenderPipeline` and `LiquidGlassPanel` implementations. A nonuniform HDR scene capture and the pipeline's separate blur captures are prepared once per size. Both paths read those same textures. One regular glass panel uses the stage camera; an overlapping minimap glass panel uses its own off-axis camera. Their depth clears and rendering order come from the unchanged `renderBackgroundPanels()` method. Small depth-tested witnesses inside those groups make the depth-clear ordering observable.

The reference calls `renderStageDisplay()` and `renderBackgroundPanels()` on a CanvasTarget. The candidate draws the same linear stage-display quad and the same panel sequence into a separate RGBA16F target with four MSAA samples and depth. A public Three `RenderPipeline` samples that target with `screenUV` and applies the final output transformation. The target is never a glass input, so the experiment introduces no read/write feedback with `sceneCapture` or its blur textures.

The final transformation remains Three's `RenderOutputNode`: unpremultiply, tone mapping, output color conversion, then premultiply. The candidate does not convert intermediate results to eight-bit color or mix already tone-mapped images. Its public renderer state is restored in `finally`, including canvas/targets, viewport/scissor, clear values, automatic-clear flags, tone mapping, exposure, output color space and XR enablement.

Frosted panels have a native CSS surface in this framework, not a GPU Frosted material. The fixture therefore also renders two actual Svelte `Panel surface="frosted"` components over the resulting canvases. A minimal registration context avoids instantiating an unrelated second Stage renderer. The final DOM screenshots test the real backdrop-filter, tint, rounded surface and text. No substitute Frosted shader is introduced.

## Linear readback and output comparison

The linear comparison uses public `copyFramebufferToTexture`, `copyTextureToTexture` and `readRenderTargetPixelsAsync` APIs with a HalfFloat readback attachment. In the installed Three r186 source, a framebuffer copy outside a render call uses the explicitly bound target or, for a Canvas, its current linear intermediate. The reference's copy therefore observes the linear framebuffer after the ordered panel draws; the candidate's copy observes its explicit linear target. The experiment requires HDR values above one to remain present and compares decoded half-float channels exactly.

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

Preparation checks on 2026-11-01: `npm run check --workspace @spatial-elements/demo-sveltekit` completed with zero errors and zero warnings; `playwright test --config playwright.background-layer-output.config.ts --list` loaded exactly one test. No build, browser execution or measured pixel/submit result is included in this preparation checkpoint.
