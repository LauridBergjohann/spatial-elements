# GPU readiness for source-only navigation

The first phase moves the already displayed Low geometry and its real DOM presentation. It must not allocate textures, buffers or pipelines, compile shaders, instantiate the destination scene, or mount destination DOM. The destination layout is resolved numerically; the normal page binding runs only after the final moving frame has had a paint opportunity.

## Readiness is earned before a click

After an ordinary frame, idle preparation renders the existing catalog fade and handoff passes behind a zero-area output scissor. Offscreen passes may fill their retained scratch textures; no preparation pixels reach the visible canvas. Borrowed scene membership, transforms, camera, fog, and renderer state are restored synchronously. GPU queue completion then publishes readiness for the current viewport, output dimensions, environment, and layout revision.

An actor must also have rendered visibly and restored its authored material transparency/depth-write state. A still-fading carousel seat is not eligible. `beginStagedDetailMotion()` declines an unprepared source so the ordinary navigation path remains available. No warming occurs in that click path. Completion schedules another idle check because a second actor can become visible while the previous GPU submission is pending.

Carousel preparation uses the real rear and front render paths, including the selected theme's glass backdrop and depth blur. Preparing only an equivalent geometry scene is insufficient because those output passes have their own pipeline variants.

## Submit the first changed frame once

Progress zero preserves the already displayed source pixels. After capture, Stage cancels its pending independent render callback and keeps subsequent invalidations dirty without scheduling a replacement. The source-motion clock submits the first changed DOM/GPU pose together through `flushCatalogFrame()`, which releases this initial pause. Cancellation also releases it and schedules the restored source. This avoids an unchanged full render before the first visible reaction; it does not skip any moving frame or reduce rendering quality.

## Keep pipeline owners stable

A production WebGPU probe found a pipeline creation in the first moving frame even though the shaders and the complete GPU pipeline descriptor were already prepared. The affected shader was the catalog fade's texture-times-alpha composite.

In the installed Three r186 renderer, render contexts are shared by attachment format and sample count, while the pipeline cache key additionally includes the color space. The same fullscreen quad was used for both the Canvas output's linear working color space and a speculative High preparation target. Switching that quad's render object to the second variant could release the first pipeline owner. Its next visible use recreated an identical GPU pipeline.

`CatalogGeometryFade` therefore retains separate Canvas and offscreen quad objects. They share the existing capture texture, material, and alpha uniform, but keep the two render-object owners alive. Both objects are created during preparation. Alternating High preparation and visible catalog fading cannot displace the warmed Canvas owner.

## Endpoint and cancellation parity

The fit distance uses the intrinsic resolved media rectangle. The camera offset uses the visible viewport-clamped rectangle, matching the mounted detail's camera behavior in short windows. Treating both as the unbounded rectangle produces a visible final-position error despite a correct normal-height layout.

Before route commit, cancellation restores the same catalog actor and its canonical local model matrix. After the route binding changes, cleanup releases the outgoing actor rather than reviving a detached source. Retained carousel glass uses the source's existing resources, receives the same projected quad as the DOM in each frame, and fades out during content reveal.

## Verification

Core tests cover short-viewport projection parity, projective glass/DOM agreement, capture ownership on cancellation, preparation failures and stale completion, and stable Canvas/offscreen fade owners. `tests/staged-production.e2e.ts` observes real DOM identity, target mount timing, source query width, moving-phase child mutations, and GPU creation calls. `tests/staged-pipeline-diagnostic.e2e.ts` additionally records shader fingerprints and full pipeline descriptors to distinguish missing variants from cache-owner replacement. First-motion and held/reveal timestamps come from the production controller, rather than an independent animation substitute.

The production build validated on 2026-10-31 recorded zero pipeline, shader, texture, or buffer creations throughout both List and Carousel moving phases. Its single-run click-to-first-submitted-frame measurements were 75.6 ms and 121.2 ms respectively, before removing the unchanged progress-zero render. These samples establish resource reuse, not a latency percentile; the repeated performance suite measures the latency target separately. The private Watches glass theme has its own diagnostic mode (`SPATIAL_PIPELINE_EXAMPLES=1`).
