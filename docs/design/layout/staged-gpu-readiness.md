# GPU readiness for source-only navigation

The first phase moves the already displayed Low geometry and its real DOM presentation. It must not allocate textures, buffers or pipelines, compile shaders, instantiate the destination scene, or mount destination DOM. The destination layout is resolved numerically; the normal page binding runs only after the final moving frame has had a paint opportunity.

## Readiness is earned before a click

After an ordinary frame, idle preparation renders the existing catalog fade and handoff passes behind a zero-area output scissor. Offscreen passes may fill their retained scratch textures; no preparation pixels reach the visible canvas. Borrowed scene membership, transforms, camera, fog, and renderer state are restored synchronously. GPU queue completion then publishes readiness for the current viewport, output dimensions, environment, and layout revision.

An actor must also have rendered visibly and restored its authored material transparency/depth-write state. A still-fading carousel seat is not eligible. `beginStagedDetailMotion()` declines an unprepared source so the ordinary navigation path remains available. No warming occurs in that click path. Completion schedules another idle check because a second actor can become visible while the previous GPU submission is pending.

Carousel preparation uses the real rear and front render paths, including the selected theme's glass backdrop and depth blur. Preparing only an equivalent geometry scene is insufficient because those output passes have their own pipeline variants.

Readiness also includes the first keyboard/focus outline. Focusing the activated link happens before Kit's navigation callback; otherwise that ordinary source frame can create the silhouette texture, mask pipeline and composite pipeline before the movement owner takes control. Idle preparation temporarily applies a nonzero hover to prepare the actual offscreen bands, then prepares the Canvas outline variant explicitly and restores the source hover before yielding. The mask pass may ignore scissoring, but the final composite must respect the incoming zero-area scissor. Separate Canvas/offscreen quad owners retain both output variants.

## Submit the first changed frame once

Progress zero preserves the already displayed source pixels. After capture, Stage cancels its pending independent render callback and keeps subsequent invalidations dirty without scheduling a replacement. The source-motion clock submits the first changed DOM/GPU pose together through `flushCatalogFrame()`, which releases this initial pause. Cancellation also releases it and schedules the restored source. This avoids an unchanged full render before the first visible reaction; it does not skip any moving frame or reduce rendering quality.

The motion clock starts before synchronous source preparation. Immediately after preparation, the controller submits the actual elapsed progress instead of waiting for another animation frame. The first time contribution is capped at one nominal 60 Hz frame; if preparation took longer, the clock shifts so the remaining motion still plays continuously. An earlier RAF timestamp cannot reverse the first submitted pose or submit that unchanged pose again. Reduced Motion submits the endpoint immediately, then leaves a RAF paint barrier before the following RAF may prepare destination ownership. Neither barrier draws an additional frame.

## Browser compositing is a separate preparation concern

Zero WebGPU resource creations do not guarantee that the browser's DOM compositor has already compiled every raster shader. A Windows Intel Gen11 diagnostic showed a 317 ms RAF gap while JavaScript remained short: Chrome's GPU raster worker spent 257 ms in its raster flush, including ANGLE/D3D shader compilation, and Viz waited on the resulting synchronization token. The preceding paint included the real Carousel summary and summary island.

The enhanced Carousel therefore declares `will-change: transform` on only its selected summary and its real presentation island before activation. A controlled CSS-injection trace against the same production bundle removed the moving-phase compiler events and the 300 ms gap while preserving the existing DOM, rounded/frosted surface, and live 3D geometry. This diagnostic supports the bounded promotion; it is not a latency percentile or a replacement for the uninstrumented repeated suite. Other cards and inactive Carousel panels are not permanently promoted.

`scripts/trace-staged-gpu.mjs` records browser GPU/Viz events, source styles, actual RAF callback times, WebGPU queue submissions and asynchronous queue fences. Fences include driver/IPC delay and delay in dispatching their JavaScript completion callback; their wall-clock duration is not pure GPU execution time. The trace and its fence instrumentation are diagnostic only.

For CPU attribution, `--minimal=true --cpu=true` writes an additional 1 ms `cpu.cpuprofile` while omitting render-pass descriptors, shader-body copies and per-submit timing marks. The normal JavaScript callbacks and GPU/Viz events remain in `trace.json`; `probe.json` records the exact phase boundaries and instrumentation settings. `--fences=false` provides a control without the extra asynchronous queue fences. Profiling results must not replace the uninstrumented latency or frame-pacing measurements.

## Keep pipeline owners stable

A production WebGPU probe found a pipeline creation in the first moving frame even though the shaders and the complete GPU pipeline descriptor were already prepared. The affected shader was the catalog fade's texture-times-alpha composite.

In the installed Three r186 renderer, render contexts are shared by attachment format and sample count, while the pipeline cache key additionally includes the color space. The same fullscreen quad was used for both the Canvas output's linear working color space and a speculative High preparation target. Switching that quad's render object to the second variant could release the first pipeline owner. Its next visible use recreated an identical GPU pipeline.

`CatalogGeometryFade` therefore retains separate Canvas and offscreen quad objects. They share the existing capture texture, material, and alpha uniform, but keep the two render-object owners alive. Both objects are created during preparation. Alternating High preparation and visible catalog fading cannot displace the warmed Canvas owner.

## Prepare destination passes before the content reveal

Source readiness and destination readiness are separate contracts. Binding the destination while its enter opacity is zero deliberately excludes its minimap and invisible panels from ordinary rendering. A trace of production build 39072 found no moving-phase allocations, but the subsequent reveal still created fractional and opaque minimap pipelines, Gaussian blur pipelines, and their intermediate targets. The resulting GPU decoder work overlapped the reveal. That trace did not show the earlier DOM raster-shader compilation during this phase.

After destination binding and before the reveal clock begins, `prepareStagedReveal()` selects full output quality and applies fractional alpha and the exact opaque endpoint to the actual destination. Explicit quality selection prevents a pending scroll-restoration timer from switching to cold full-quality targets during reveal. `warmRevealFrame()` submits that scene capture, every bound panel blur capture, and the real background/foreground output variants. It uses the existing Canvas contexts with a zero-area scissor and never clears their color attachment; such clears may ignore scissoring. The live destination DOM stays hidden. Preparation restores all borrowed presentation and renderer state synchronously before waiting for GPU queue completion. Abort, disposal, or a changed page binding rejects the completed readiness result.

Minimap display meshes retain separate authored and fade material objects. The fade object remains transparent with depth writes disabled; the authored object retains its original state. Both share the existing geometry and texture assets. Switching their material identities retains two renderer cache owners rather than repeatedly changing one material's shader/depth state and evicting its prepared pipeline. Both owned material sets are disposed with the minimap.

Focused CPU tests verify state restoration on success/failure, stale and aborted fences, masked Canvas output without color clears, and stable material identities/versions across repeated alpha endpoints. This preparation still requires a fresh production trace and uninstrumented reveal measurements; the source-only resource result does not establish destination readiness.

A subsequent 91281 trace confirmed those previously cold WebGPU passes were prepared before reveal. It also identified a separate pair of full-viewport RGBA8 textures: completing Low-to-High refinement replaced the outline target, and `renderStageDisplay()` immediately rebound that new sampler even with outline opacity zero. Outline replacement now retains its existing target, mask/composite materials and quad; only the silhouette model changes and its cached pixels become invalid. Viewport changes still resize the target, and page release still disposes all owners. This avoids an unrelated texture allocation during content reveal without reducing the outline quality.

The same build's List reveal exposed a different first-use cost: real DETAIL painting triggered rounded-rectangle and tessellated-path shader compilation in Chrome's raster worker. A controlled `--prepareDom=true` trace against the unchanged bundle allowed the actual incoming DOM to rasterize at alpha 0.001 during the held phase. Its DETAIL panel/summary/tab/thumbnail Paint events and those compiler events moved before `revealStarted`; the 145–200 ms reveal raster stall disappeared. The selected source and Canvas were not replaced. This is a diagnostic result, not an acceptance percentile or an implemented DOM readiness barrier; production integration must preserve the continuous menu, abort cleanup and a paint opportunity before the reveal clock starts.

## Endpoint and cancellation parity

The fit distance uses the intrinsic resolved media rectangle. The camera offset uses the visible viewport-clamped rectangle, matching the mounted detail's camera behavior in short windows. Treating both as the unbounded rectangle produces a visible final-position error despite a correct normal-height layout.

Before route commit, cancellation restores the same catalog actor and its canonical local model matrix. After the route binding changes, cleanup releases the outgoing actor rather than reviving a detached source. Retained carousel glass uses the source's existing resources, receives the same projected quad as the DOM in each frame, and fades out during content reveal.

## Verification

Core tests cover short-viewport projection parity, projective glass/DOM agreement, capture ownership on cancellation, preparation failures and stale completion, and stable Canvas/offscreen fade owners. `tests/staged-production.e2e.ts` observes real DOM identity, target mount timing, source query width, moving-phase child mutations, and GPU creation calls. `tests/staged-pipeline-diagnostic.e2e.ts` additionally records shader fingerprints and full pipeline descriptors to distinguish missing variants from cache-owner replacement. First-motion and held/reveal timestamps come from the production controller, rather than an independent animation substitute.

The production build validated on 2026-10-31 recorded zero pipeline, shader, texture, or buffer creations throughout both List and Carousel moving phases. Its single-run click-to-first-submitted-frame measurements were 75.6 ms and 121.2 ms respectively, before removing the unchanged progress-zero render. These samples establish resource reuse, not a latency percentile; the repeated performance suite measures the latency target separately. The private Watches glass theme has its own diagnostic mode (`SPATIAL_PIPELINE_EXAMPLES=1`).

The same resource probe also passed both private Watches routes, including an explicitly verified glass Carousel surface. That run overlapped a framework/demo build, so its latency samples are unsuitable for performance acceptance; the zero moving-phase resource-creation result remains valid.
