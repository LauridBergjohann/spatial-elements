# Catalog warm-output context: compatibility review

Initial read-only findings, 2026-11-01; the optional implementation checkpoint is recorded below. There is no active production output change or performance result. References below describe the installed `three@0.186.1` (`node_modules/three/package.json:3`); its `./webgpu` export is `build/three.webgpu.js` (line 18). Recheck these internals when the dependency changes.

## Current output and readiness contract

`StageExperience.scheduleStagedPreparation()` calls the catalog preparation through the existing serialized preparation gate. In `packages/core/src/catalog/CatalogSpatialElementLayer.ts`, `prepareStagedNavigation()` has two explicit `setRenderTarget(null)` calls (lines 1081 and 1100). The first warms rear/front/fade passes; the second warms the focused outline's Canvas variant. Handoff models are then rendered in the restored outer destination. Glass, geometry fade, outline, depth blur and ground helpers otherwise return to their borrowed destination.

An explicit scratch target can therefore keep this call chain's draws and clears away from the Background Canvas. It must not be the retained Background layer itself: intermediate preparation writes would replace owned color/depth pixels even if no final output was published. Offscreen captures still need real pixels; a zero-area scissor is not a substitute for preparing those captures.

However, productive catalog output still uses separate Canvas bands: `StageRenderPipeline.renderCarouselRear()` (line 291) selects the rear Canvas, and `renderForegroundLayer()` (line 885) selects the foreground Canvas for front actors and handoff. Replacing the two warmup destinations alone would warm different persistent render-object owners:

| Composite | Current owner selection |
| --- | --- |
| `CatalogGeometryFade.ts:60` | Non-null destination uses `offscreenQuad`; Canvas uses `quad`. |
| `CatalogModelOutline.ts:112` | Separate offscreen and Canvas quads. |
| `CatalogDepthBlur.ts:80` | Cached ground resolve has separate `resolvedOffscreenQuad` and `resolvedCanvasQuad`; the normalized cache-copy owner is separate again. |

`stagedSignature()` (catalog layer line 1036) currently covers warm revision, viewport/drawing-buffer dimensions, coordinate system and environment UUID, but no output profile. The same signature keys ground preparation. Actor readiness is published only after synchronous restoration and the GPU fence (lines 1137–1140), subject to source ownership and signature checks. Any output change must preserve that meaning, including already-ready actors during a ground-only fence, source freeze and cancellation.

Scene-endpoint preparation is independent: `StageRenderPipeline.withSceneCapture()` and `isSceneCaptureCurrent()` (lines 736/746) select/check the actual scene target; refinement also protects its Low/High write epochs. A catalog-output experiment should leave those guards intact. Separately, `warmRevealFrame()` (line 708) still selects Background Canvas/null for its display/panel warm draws. Fixing catalog preparation alone cannot establish a global “Background implicit target is never allocated” guarantee.

## Why matching HalfFloat/4× MSAA is insufficient

Installed Three references:

- `src/renderers/common/Renderer.js:1561`: `_getFrameBufferTarget()` creates the Canvas intermediate using renderer depth/stencil, output buffer type, RGBA, working color space and renderer samples. Its viewport/scissor are scaled by the Canvas pixel ratio.
- `src/renderers/common/RenderContexts.js:57–67`: attachment count/format/type/samples/depth/stencil, MRT and call depth determine the render-context key.
- `src/renderers/common/RenderObjects.js:105–108`: object, material, render context and lights node determine the persistent render-object owner. Changed cache keys can dispose/recreate it (line 138).
- `src/renderers/common/Renderer.js:2663–2688`: output-target status changes current tone mapping/color space. Equal attachment formats do not alone prove equal shader/output behavior.
- `src/renderers/common/Renderer.js:2270/2340`: `setScissor()` and `setViewport()` address the CanvasTarget. Explicit target viewport/scissor state requires its own handling/restoration; the existing renderer-state helper does not snapshot arbitrary RenderTarget fields.

A minimal experimental context could carry a separate persistent scratch target, an output-profile key and a generation/current-owner predicate. Its physical dimensions, depth/stencil, samples, linear color space and viewport must match the intended productive context. Readiness needs the profile in its signature and a current-owner check after the fence. Canvas-semantic composite owners must also be prepared, or readiness must remain false. This is an API candidate, not approval to change the public API or redirect retained output.

## Compile-only alternative: asynchronous mutable reads

Compiling existing Canvas owners on the already allocated foreground Canvas could avoid a Canvas draw. It is not currently a drop-in replacement for the synchronous borrowed-state section:

- `Renderer.compileAsync()` starts at source line 896. With an initialized renderer, it collects work and restores the render-tree state before processing the queued items, but then **awaits** `getForRenderAsync(renderObject)` at line 1068 and yields between objects at line 1099. The exported build contains the same await at `build/three.webgpu.js:62729`.
- `_createObjectPipeline()` stores live object/material/scene/camera/context references (source line 3925). Later objects are created from those references after earlier awaits. Node updates, geometry/binding preparation and pipeline creation also occur after awaits. Immediate restoration of borrowed poses, fog, environment, material variants or renderer context is therefore not proven safe.
- `QuadMesh.render()` temporarily assigns its private fullscreen `vertexNode` and restores it on return (`src/renderers/common/QuadMesh.js:114–120`). A scoped renderer port forwarding the call to `compileAsync()` avoids monkey-patching the real renderer. For the first ordinary single quad, `NodeBuilder.prebuild()` and `NodeMaterial.setup()` capture that vertex node before the first yield (`NodeBuilder.js:3243–3245`, `NodeMaterial.js:485`). This narrow observation does **not** establish safe asynchronous lifetime for the complete model/composite chain.
- `compileAsync()` itself can request a Canvas intermediate (`Renderer.js:932`) and runs scene/object callbacks. It must not be described as allocation-free or assumed safe for arbitrary custom callbacks. Using an already allocated foreground output would still need an explicit ownership/state contract.

Do not retain mutable scene state across an await merely to make this approach work. First prove a narrow compile-only adapter with the real owner and asynchronous lifecycle, or keep the existing warm/readiness fallback.

## Smallest useful next proof

Use the real catalog owners with one explicit scratch-output context; compare against the current warm path without changing acceptance thresholds. Include one List and both frosted/glass Carousel paths, preserving the RGBA8 glass backdrop, HalfFloat fade, ground caches and live ground fallback. Check linear pixels, final Canvas pixels, depth/clipping and full renderer/target-state restoration, including failure.

Then perform the **first real focus/moving draw**, both immediately after warming and after intervening High preparation. Count all five existing GPU-creation categories, not only shader compilation: render pipelines, asynchronous render pipelines, shader modules, textures and buffers. This detects wrong owners, output-profile differences, cache eviction and first-use allocations. Verify that Background Canvas pixels remain unchanged and a read-only `_frameBufferTargets.has(backgroundCanvas)` diagnostic stays false; never allocate that diagnostic target through a lookup.

Finally cover resize/DPR, target replacement, freeze/cancel while the fence is pending, and stale readiness rejection. If compile-only is explored, add controlled mutable-state changes during its actual asynchronous yields and compare the next productive draw. No production integration or speed claim follows until these distinct compatibility and first-use checks pass.

## Optional implementation checkpoint

`catalog/CatalogWarmOutputContext.ts` now provides an internal factory owning a separate scratch target. The production `scheduleStagedPreparation()` call is unchanged. The factory derives attachment type, samples, depth/stencil, working color space, physical dimensions and DPR from the renderer/Canvas; it conservatively accepts only the known WebGPU HalfFloat/4×, normal-depth, ACES/sRGB profile with a full viewport. Unsupported output targets, custom render callbacks, XR, MRT and other profiles decline. No `compileAsync` adapter is implemented.

Catalog preparation, readiness queries and diagnostics can receive the same optional context. Only its outer scratch destination selects Canvas-semantic fade/outline/ground-resolve owners; nested captures retain their ordinary owners. Target viewport/scissor and renderer/scene state are restored synchronously before the fence. Readiness includes the unique context generation/profile and requires a current owner after the fence; disposal, resize and stale profiles cannot publish readiness. Ground pixel-cache keys remain independent of the outer output profile, so a subsequent normal draw can reuse the same valid pixels.

CPU checks establish these ownership, restoration and invalidation rules, not shader equivalence or zero GPU creation on the first productive frame. The real GPU compatibility proof remains a separate gate. The scratch target is full drawing-buffer size: this is acceptable for the isolated proof, but it must not become an additional permanent allocation beside the output bands. Production integration still needs a bounded scratch lifetime with separately justified post-release readiness, or an empirically proven smaller target. Neither exists here; `dispose()` explicitly invalidates this context's readiness. No memory or speed improvement is claimed.
