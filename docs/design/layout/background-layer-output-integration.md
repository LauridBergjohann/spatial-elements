# Background-layer output integration sketch

Status: **design only; no production integration authorized or implemented**. The corrected isolated proof is documented in [background-layer-output-proof.md](background-layer-output-proof.md). Protocol v2 passed on demo 39337 / proof revision a94344e with exact linear/Canvas/Frosted DOM agreement and 10→6 submissions in eligible visible-glass cases. The failed first protocol remains preserved. Protocol v3's transparent-clear, retention and allocation extensions are pending; v2 alone is not production acceptance.

## Decision and boundary

A Background-only integration appears bounded and worth evaluating if the corrected pixel and Frosted DOM proof passes. It is a coordinated output-owner change, not a replacement of `renderStageDisplay()` alone. The expected saving with one regular and one minimap glass pass is four submissions per frame; it is not yet a demonstrated frame-time improvement.

Keep the following unchanged:

- The scene capture, model/refinement rendering and separate panel blur sources.
- The order and cameras of regular and minimap glass panels, including their depth clears.
- Foreground and Carousel Rear output layers and their DOM stacking.
- Actual Frosted CSS surfaces, tone mapping, output color conversion and pixel quality.

No GPU submission batching, private Three framebuffer access, model snapshot substitution or changed material blending is part of this design.

## Proposed owner and API

Add one long-lived Background output owner to `StageRenderPipeline`, either as a private helper or a small internal class. It owns one RGBA16F render target with the validated MSAA/depth configuration and one public Three `RenderPipeline` for the final output transform. It does not own scene/blur inputs, schedule frames or control navigation.

Conceptually it needs these operations:

- **Initialize/select mode:** choose the explicit output path or the unchanged Canvas fallback after the renderer backend is initialized, before any Background Canvas draw or clear.
- **Render complete Background:** clear the explicit target, draw the existing linear stage-display quad, run the unchanged `renderBackgroundPanels()`, then publish the final output once.
- **Clear transparent:** clear and publish an empty Background using the same owner for content-only pages.
- **Warm without publishing:** prepare only explicit offscreen targets. Initialize the final output pipeline during the first legitimate transparent clear or visible publication; do not assume a later zero-scissor Canvas draw is invisible. Rewarming changed final-output contexts needs a separate no-draw/readiness proof.
- **Resize / dispose / report resources:** retain one output allocation across route and scene-capture changes; release it with the pipeline or when permanently selecting the fallback.

The owner must synchronously restore borrowed renderer state in `finally`: CanvasTarget, RenderTarget and OutputRenderTarget, viewport/scissor, clear values, automatic-clear flags, tone mapping/exposure, output color space and XR state. Three's public `RenderPipeline.render()` scopes output-transform settings, but the outer owner must also restore them if a draw throws. No borrowed state may survive an asynchronous fence.

## Entry points and lifecycle

The relevant code is in `packages/core/src/stage/StageRenderPipeline.ts` and `StageExperience.ts`.

| Entry point | Required integration |
| --- | --- |
| `StageExperience.init()` | Select the mode immediately after `renderer.init()`, before output warming or the first frame. Installed Three initialization creates renderer services; the implicit linear framebuffer is allocated when a relevant Canvas draw, clear or compile needs it. |
| `renderFrame(false, …)` | Render stage display and regular/minimap glass into the single explicit target, then publish once. Preserve all existing scene/blur preparation before this output sequence. |
| `renderFrame(true, …)` | Route the transparent content-only clear through the same owner. Preserve the current complete skip when `outgoingBackground` is retained. |
| `freezeBackground()` | Publish the complete outgoing Background through the owner. Keep the resulting Canvas pixels as the existing transition does. |
| `warmRenderTargetSets()` | Warm the same complete output sequence for both scene-quality sets; finish by publishing the active set. Do not allocate a separate output target per quality set. |
| `warmRevealFrame()` | Warm the explicit target offscreen without touching the presented Canvas. The unchanged final output should already be prepared by its first legitimate clear/publication. A later masked publication is not an established preservation mechanism. |
| `resizeRenderTargets()` | Size the explicit target to the actual Background Canvas drawing buffer. Preserve the existing held-background resize rule; a retained outgoing Canvas and its output target keep their dimensions until a new output is required. |
| `disposeSceneCapture()` | Dispose only scene/blur resources. The output owner must survive route rebinding and outgoing-background retention. |
| `dispose()` | Dispose the output target and final RenderPipeline together with the Stage pipeline. Include the explicit target in the diagnostic resource inventory. |

`setScrollRenderQuality()` changes the sampled scene/blur sources, not the output Canvas density. The output owner therefore remains a single target at the Canvas size; it must not mirror the full/scroll target-set duplication.

### Catalogue preparation is an additional allocation path

`StageExperience.scheduleStagedPreparation()` currently calls `CatalogSpatialElementLayer.prepareStagedNavigation(renderer)` while the current Canvas has been restored to Background. That preparation explicitly binds `setRenderTarget(null)` and draws its real Canvas variants with zero-area scissor. This can allocate the implicit Background framebuffer. Zero-area scissor alone is not an established guarantee that a submitted Canvas frame preserves the already presented image.

The earlier suggestion to lend the existing **Foreground CanvasTarget** is withdrawn. The current preparation would still submit Canvas draws there, so a swap could put visible catalogue models at risk. Do not solve the Background allocation issue by moving the same unproved operation to another visible layer.

A separate design must prepare the required variants without drawing into a presented Canvas: explicit offscreen draws, a carefully scoped compile-only path, or an independent bounded warm context. None is proved equivalent yet. `compileAsync()` itself can allocate an implicit target for its selected Canvas, and compilation alone does not establish that node-driven capture/blur resources are prepared. A small warm target can also have different size-dependent capture allocations or context variants. The existing renderer/scene-state restore, signature validity and fence contracts must remain intact, and an actual first Moving-frame resource proof is required. This unresolved preparation path is an integration gate, not an approved implementation shortcut.

This path is why changing only ordinary detail output would leave both linear Background allocations alive even if the new output itself never requests the implicit one.

## Conservative fallback

Initially enable only the backend and output configuration exercised by the completed proof: WebGPU, validated color format/MSAA/depth settings, full viewport and ordinary output state. Keep the old path for unsupported configurations such as foreign MRT/OutputRenderTarget, XR, reversed/nonstandard depth or an unproved viewport/scissor mode.

Hidden preparation must not depend on publishing a zero-scissor Canvas frame. Such a path is excluded until actual presented-pixel preservation is proved; pure offscreen preparation is distinct from that case.

If an unsupported configuration appears after the explicit owner has been selected, dispose that owner and select the old path for the remainder of this pipeline instance. Do not silently alternate back into the explicit path: the old Canvas draw may have allocated an implicit framebuffer whose lifetime is owned internally by Three. Keeping both would violate the memory objective. Any more flexible switching would need a separate ownership design and proof.

The production integration must not borrow or destroy a private Three framebuffer, reuse a disposed CanvasTarget speculatively, or change global renderer output settings across unrelated bands.

## Memory bound

The explicit target must **replace**, not supplement, the implicit Background target. For the currently considered four-sample configuration, the logical attachment estimate is:

| Attachment | Bytes per physical pixel |
| --- | ---: |
| Resolved RGBA16F color | 8 |
| Four-sample RGBA16F color | 32 |
| Four-sample Depth32 | 16 |
| Total before optional depth resolve / driver overhead | 56 |

This is about **76.9 MiB at 1440 × 1000 physical pixels**, or **110.7 MiB at 1920 × 1080**. Doubling both dimensions quadruples the estimate. The current default render settings cap pixel ratio at one and output pixels at `1920 × 1080`; retain these existing bounds. Explicit user overrides remain explicit overrides, not an excuse for an extra hidden target.

Maintain one output target, resize it in place, and report its dimensions/sample count in the existing target inventory. SceneCapture, blur targets, Foreground/Rear resources, Canvas output storage, optional depth resolve and driver overhead remain separate accounting entries. A resource trace must confirm that the explicit and implicit linear Background targets do not coexist throughout normal initialization, catalogue warming and navigation. Logical byte estimates alone do not prove that condition.

## Missing proof and acceptance work

Before production implementation:

1. Preserve protocol v2's completed strict linear/Canvas/Frosted DOM comparisons and independent padded-readback controls. Exact comparison limits remain zero.
2. Complete protocol v4's checkpoint-based transparent content-only clear and retained outgoing Canvas cases, including hidden warmup without publication and the read-only allocation diagnostic. The filled-Hero comparison does not establish these cases. The masked-publish checkpoint remains a separate diagnostic candidate, not an accepted retention path merely because the offscreen path passes.
3. Review initialization and fallback ownership, including the catalogue preparation context described above.

On build 28778, the Background v3 positive control exposed an observation limitation: a Canvas2D copy of a WebGPU canvas after a fence and two RAFs was empty even with no intervening warm draw. Consequently the lifecycle's later zero-difference values cannot prove retained display pixels. Similarly, a before/after comparison that crosses a readback await cannot by itself attribute a 255-channel difference to a warmup. The next retention proof must capture actual DOM/compositor screenshots at explicit checkpoints, include a no-op paint/fence control, and keep linear attachment readbacks separate. Until then, both the alleged masked-Canvas safety and any claim of visible masked-Canvas damage remain unproven by those readbacks.

During a separately authorized implementation:

1. Verify target creation and disposal from the first frame, with no persistent duplicate implicit Background allocation; cover fallback, resize, scene-quality switches and route rebinding.
2. Verify renderer-state restoration and subsequent successful rendering after an injected draw failure.
3. Warm the final output and actual glass contexts during existing preparation phases; retain existing fences. Confirm that Moving and Reveal introduce no new GPU resources or pipelines.
4. Run the existing navigation, cancellation, outgoing-background and minimap/zoom regressions, then measure the unprofiled frame distribution. Submission savings alone do not satisfy the navigation pacing requirements.

The intended scope is one output owner plus its necessary Stage lifecycle wiring. If avoiding duplicate allocations requires broad changes to unrelated bands or Three internals, stop and reassess rather than expanding this optimization implicitly.
