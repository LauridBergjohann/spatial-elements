# Performance analysis

Analysis date: 2026-10-01. Baseline: commit `2f1196f`, including the five procedural demo geometries.

The demo's main costs are repeated full-screen rendering, preparation of render targets and
shaders, and DOM style/layout work. Geometry simplification is not the appropriate first fix.
The package now limits WebGPU resolution independently of HTML resolution, bounds temporary
captures, avoids redundant submissions and layout reads, and prepares effects before interaction.
Cold navigation still needs separate attention; a smooth steady interaction does not establish
that the first navigation is free of long frames.

## Measurement conditions

The reported machine is a Surface Book with an i7-1065G7 and GTX 1650, a 3000 by 2000 display,
200% zoom and an approximately 1098 by 831 CSS-pixel browser viewport. Measurements use the local
production demo, installed headless Chrome 154, that CSS viewport, and device scale factor 2.
The final run records the renderer's actual `requestAdapter` call: **Intel Gen11**, using WebGPU
compatibility mode. Independent default and high-performance adapter requests also select Intel.
These measurements do not establish GTX 1650 performance or the adapter used by an already-open
Chrome window under a different Windows/browser profile.

The profiler records real browser animation-frame intervals, long tasks, Chrome main-thread
metrics, navigation timestamps, output sizes and render-target inventory. Scroll and zoom use
actual mouse-wheel input. Synthetic `stage-test` frame advancement is reserved for functional
tests and is not used for performance measurements. The final profiler verifies scrolling,
model enlargement and a close-up focus above 0.8, and separates navigation preparation from the
`animating` phase.

Frame percentiles cover the interaction and a short settling tail. They are **not GPU timings**
or an average of continuously rendered FPS. Idle frames can lower the median. Cold compilation,
browser scheduling, thermal state and other applications introduce variation; results are
single-run diagnostics, not a statistically controlled benchmark. Main-thread `TaskDuration`
already includes script, style and layout time: these values must not be added together.

Local raw captures are kept in `.artifacts/performance/` (ignored by Git). The baseline and
intermediate captures remain available alongside the final result. Earlier runs did not include
phase/gesture validation; the later matching wheel sequence confirms the mild zoom enlarges the
model by approximately 22% without entering the close-up UI. Full close-up is measured separately.

## Measured results

The final run keeps native DPR 2 and uses the new **render** ratio 1. It includes all listed
optimizations and prewarming on detail binding. Values below are browser RAF intervals in ms.

| Scenario | Baseline median / p95 | Final median / p95 | Final maximum |
| --- | --- | --- | --- |
| List to detail, including preparation | 16.7 / 183.0 | 16.7 / 33.4 | 816.8 |
| Carousel to detail, including preparation | 16.7 / 116.7 | 16.7 / 33.5 | 533.5 |
| Scroll after list navigation | 16.7 / 50.1 | 16.7 / 33.3 | 100.1 |
| Scroll after carousel navigation | 16.7 / 66.7 | 16.7 / 18.0 | 66.6 |
| Mild zoom after list navigation | 33.5 / 50.2 | 16.7 / 16.8 | 18.3 |
| Mild zoom after carousel navigation | 50.0 / 66.8 | 16.7 / 16.8 | 33.2 |
| Full close-up after list navigation | Not captured | 16.7 / 33.3 | 150.0 |
| Full close-up after carousel navigation | Not captured | 16.7 / 19.9 | 66.7 |

Sources: `baseline-surface.json` and `final-surface.json`. The final sampler additionally starts
at an RAF boundary, records phases/gesture extrema and drains pending long-task entries. Do not
treat small differences or maximum-frame improvements as a controlled statistical comparison.
Actual full close-up reaches focus 0.935 in both final scenarios; scroll travel is 1170 CSS pixels.

The final moving transition phase has median 16.7 ms in both views, p95 33.4 ms for list and
49.9 ms for carousel, with maxima 100.0 and 83.3 ms respectively. The largest 816.8/533.5 ms
frames occur in the **captured/preparing** phase. The baseline list maximum was 650.1 ms:
**prewarming has not improved cold navigation latency**, and can move more work before motion.
The package is substantially better at sustained interaction, but these results do not justify
a claim of uninterrupted 60 FPS or hitch-free cold navigation.

On the main thread, the list scroll scenario fell from about 1773 to 1046 ms total task time,
and style recalculation from 187 to 75 ms. The carousel scroll scenario fell from about 1557 to
1018 ms, with style recalculation from 140 to 80 ms. These totals cover the whole gesture and
settling period, not individual frame times.

## Findings and implemented changes

| Area | Evidence and change | Scope and tradeoff |
| --- | --- | --- |
| Output resolution | The old cap was DPR 2 with no pixel-area budget. At 1098 by 831, that is 3,649,752 pixels per full-size image. The default is now DPR 1, or 912,438 pixels: 75% fewer pixels per such pass. | Configurable on `Stage`, `BrandStageShell` and `StageExperience`. HTML text remains at native resolution. 3D edges are less densely sampled on high-DPI screens. |
| Temporary catalog fades | A prepared approximately 524k-pixel capture grew to full drawing-buffer size on the first moving frame. The fade now retains the same 524,288-pixel budget as Low/High refinement. | Prevents a large allocation during motion. Temporary fades are less detailed; settled geometry follows the configured stage resolution. |
| Empty catalog submissions | Empty rear/front scenes and an empty unclipped carousel scene were still submitted. Three's canvas render path also applies a full-screen output conversion for each such submission. | Empty bands now skip rendering while retained handoff geometry remains visible. |
| Backdrop resolve | A Gaussian image calculated at half CSS density was copied back to full output density. | Resolve textures now retain the Gaussian density and normalized UV mapping. At old DPR 2, this removes 15 of every 16 resolved pixels for blur values of at least 4. Zero-blur textures retain sharp resolution. |
| Minimap DOM projection | CPU sampling attributed about 346.5 ms to `offsetLeft` in `renderFlatMinimapSurface` during one baseline navigation. It followed style/CSS3D writes and forced synchronization. | Projected surfaces explicitly own a zero-margin origin; the transform now uses that origin without reading DOM offsets. Corner-projection tests cover rest, tilt and resize. |
| Carousel layout | Every actor wrote hit-target styles before reading the next summary's `offsetWidth`/`offsetHeight`. | Summary dimensions are cached in the measurement phase and invalidated by `ResizeObserver`, including changes to summary content. |
| Scroll styles | Every virtual-scroll frame changed an inherited custom property on the whole document subtree, with only one docked-minimap consumer. | Only the docked minimap now receives its compensated position. Fractional/reverse scroll, desktop/compact docking and teardown are tested. |
| Zoom clock | Wheel and SpaceMouse events overwrote the timestamp used to calculate the next rendered-frame delta. Input immediately before RAF shortened damping time. | Only rendering advances the frame clock. Burst-input tests exercise the actual stage/input wiring. |
| Transition DOM snapshots | Appending/hiding one snapshot before measuring the next repeatedly dirtied connected DOM. | Outgoing and incoming clones are collected while detached and appended after measurement. Complete computed styles and cleanup behavior are retained. Unchanged transition opacity values are not rewritten. |
| Minimap ring | Identical viewport geometry rebuilt contour vectors, bounds and GPU buffers on every update. | Exact input caching skips unchanged updates; changed radii/dimensions still invalidate it. |
| First interaction after navigation | Initial stage creation warmed both quality target sets, but page rebinding did not. Hidden frosted minimap blur therefore remained cold until zoom. | Rebinding now warms full and scroll sets before motion, followed by existing zoom preparation and GPU completion synchronization. This deliberately spends work during binding instead of the first gesture. |

Relevant implementation entry points:

- [Render resolution policy](../packages/core/src/stage/renderSettings.ts) and [render pipeline](../packages/core/src/stage/StageRenderPipeline.ts).
- [Catalog rendering and measurement](../packages/core/src/catalog/CatalogSpatialElementLayer.ts), [fade capture](../packages/core/src/catalog/CatalogGeometryFade.ts), and [transition snapshots](../packages/core/src/catalog/CatalogTransition.ts).
- [Frame lifecycle](../packages/core/src/stage/StageExperience.ts), [DOM projection](../packages/core/src/stage/PanelPresentationController.ts), and [virtual scrolling](../packages/core/src/stage/VirtualScrollController.ts).
- [Dock positioning](../packages/core/src/spatial-element/SpatialElementDockController.ts) and [minimap geometry](../packages/core/src/stage/minimap/MinimapGeometry.ts).

## Repository areas examined

The review covered core stage scheduling, interaction/picking, render/output bands, blur and
outline passes, panel geometry and projection, minimap rendering, virtual scroll/docking,
catalog composition and transitions, asset preparation/caching, and Svelte lifecycle/navigation
and scrollspy behavior. The asset generator and production demo were checked against these paths.

All five low-detail demo models together contain only **1,692 triangles**. The largest high-detail
model contains **9,216 triangles**, its GLB is approximately 227 KB, and the HDR is approximately
131 KB. Each model has one mesh. This is consistent with the observation that lowering output
resolution materially improves interaction while changing no geometry.

Asset loading already deduplicates resources, separates instance/lease lifetimes, bounds idle
cache entries and bytes, and limits concurrent visible-preview requests. Rendering is already
invalidated on demand rather than using an unconditional permanent frame loop. These mechanisms
were preserved. More aggressive mesh compression, a new worker pipeline, or replacing the
framework are not supported as priorities by the measurements collected here.

## Remaining priorities

1. **Cold navigation and shader variants.** Preparation still causes a visible delay before
   motion, and some animation frames remain above the 16.7 ms target. Separate route binding,
   computed-style cloning, GPU allocation and shader compilation in a full Chrome trace before
   changing readiness ownership. Warm-up must match the actual render variants: the prepared
   High scene has no fog while the moving handoff scene may have fog. A new variant is a
   source-derived hypothesis, not a measured attribution for every spike.
2. **Output-band composition.** Three r185 allocates an internal HalfFloat/MSAA framebuffer per
   canvas and applies output conversion per canvas scene submission. The background path copies
   its capture through this additional framebuffer. Consolidating each band into one linear
   composition/output pass could reduce bandwidth further, but requires alpha, tone-mapping,
   glass and backdrop visual regression checks. The existing target inventory does not include
   these private Three framebuffers and is not a complete VRAM meter.
3. **Inherited transition styles and scrollspy.** Changing transition opacity still invalidates
   descendants. The detail scrollspy reads computed styles and section bounds after virtual
   scroll/dock changes. Cache section offsets with explicit content/resize/restoration
   invalidation, or introduce a coordinated read-before-write phase if profiling identifies
   these as the next dominant CPU cost.
4. **Glass-specific cost.** A glass minimap uses a full-viewport panel capture. Cropping needs
   matching camera and shader UV changes. Resizing a glass panel also updates an indexed
   128 by 82 grid and recreates edge/shadow geometry. The demo's frosted surfaces avoid most of
   this work, so demo results cannot be generalized to all glass-heavy applications.
5. **Picking and smaller allocations.** Raw pointer/wheel events synchronously perform DOM
   occlusion queries and raycasting. Hover picking could be coalesced to RAF; wheel ownership
   must remain synchronous so page scrolling is not incorrectly consumed. Smaller per-frame
   allocations remain, but should follow the larger measured costs in priority.

The renderer cannot force Windows/Chrome to choose the discrete GPU. Hardware selection should
be recorded for every comparison instead of assuming that a laptop's installed GTX is active.

## Reproduce and tune

Run from the repository root in PowerShell:

```powershell
$env:PROFILE_WIDTH='1098'
$env:PROFILE_HEIGHT='831'
$env:PROFILE_DPR='2'
npm.cmd run profile:demo -- my-surface
```

This builds the packages and production demo, starts an isolated preview server on port 4175,
profiles list/carousel navigation, scrolling, mild zoom and close-up, then writes
`.artifacts/performance/my-surface.json`. `PROFILE_PORT` changes the port; the server is closed
after the run. `PROFILE_CPU='list-to-detail'` additionally writes a Chrome `.cpuprofile` for that
scenario. `PROFILE_CLOSEUP='0'` omits the extra close-up scenarios. Run without other builds or
benchmarks in parallel. Close-up and mild-zoom validation failures stop the run instead of
silently labelling a missed input as a successful measurement.

The new default is equivalent to:

```svelte
<BrandStageShell {theme} {stage} {catalog}
  renderSettings={{ maxPixelRatio: 1, maxPixels: 2_073_600 }}>
  {@render children()}
</BrandStageShell>
```

Use `maxPixelRatio: 1.5` for denser 3D output. The previous resolution policy can be restored with
`{ maxPixelRatio: 2, maxPixels: null }`. On very large CSS viewports the area budget can lower
the render ratio below 1. These are stage-wide rasterization settings; they do not resize HTML,
change model LODs or alter the user's browser zoom.

Functional validation includes frame-clock burst input, docking restoration, projection math,
bounded/reused fade targets, skipped submissions, summary resize invalidation, snapshot
read/write ordering, backdrop density and unchanged ring buffers. Browser tests cover all three
catalog views, history/anchors, no-JS/no-GPU fallback, output budget, prepared scroll targets,
close-up and scrolling. Browser screenshots check the rendered close-up and docked layout;
functional tests deliberately do not impose unstable machine-dependent FPS thresholds.
