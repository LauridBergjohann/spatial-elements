# Isolated catalog warm-output compatibility proof

Status: the isolated three-mode resource and displayed-scene matrix passes on demo `13943`, borrowed runtime `6f2c7eb`, proof `be63a54`, run `88391` (**4/4, exit 0**). Earlier failed runs remain archived below. `/proof/catalog-warm-output` exercises the optional `CatalogWarmOutputContext` with actual `CatalogSpatialElementLayer` owners. This is not full Stage integration or a navigation performance result. Integration depends on correctness, lifetime and resource evidence; no further user permission is implied.

The initial matrix contains one List actor, a two-actor frosted Carousel and a two-actor glass Carousel at 960 × 640, DPR 1. It uses the existing demo Low and High GLBs through the real `SpatialElementAssetManager`, plus the actual HDR/PMREM preparation through `EnvironmentCache`. Catalogue model scenes, fade/outline/blur/ground helpers and glass compositor are not mocked. The small frosted summary is native CSS; it is not replaced by an invented GPU material.

Three separately owned CanvasTargets represent Background, Rear and Foreground. A nonuniform HDR image is legitimately published once on Background through an explicit source target and a public `RenderPipeline`, avoiding its implicit linear framebuffer. The independent Background preview sits at integer CSS coordinates (8,8), with a 240 × 160 screenshot extent. It is not a cloned canvas: Playwright captures the actual displayed WebGPU canvas. A checkpoint pauses after GPU completion and two RAFs for source, no-op, after warm and after High intervention. PNG decoding runs in Node. Exact retained pixel difference is required; Canvas2D copies are never used to infer retention.

The standalone scratch context is created against the full Background output profile. Its target is separately owned and must not alias the retained source. The additional borrowed mode uses the real Background output owner's controlled destructive lease; it shares that owner's output target while keeping its source texture separate. Public renderer state and the scratch target's own viewport/scissor are compared synchronously immediately after `prepareStagedNavigation()` returns its pending promise. Readiness must still be false before that promise finishes, true with the current context profile after its real GPU fence, and false without that profile. Read-only builtin `Map.has` observes the installed Three r186 implicit-buffer map; the proof never calls its allocating getter or mutates internal targets.

After warming, the first focus and first moving draws use the real Rear/Foreground Canvas destinations and ordinary production owner selection (no warm context passed to productive draws). Focus goes through the actual DOM focus event and must be observed by the actor. Moving uses the actual capture, source freeze, fade and handoff target APIs. All five GPU creation categories—render pipeline, asynchronous render pipeline, shader module, texture and buffer—are counted from before each first operation through its GPU fence. Every measured creation list must remain empty. Initialization, scratch warming, restoration and High work retain separate labels in the complete raw call list; they are not silently discarded from the evidence.

The High intervention is deliberately narrow: it loads a real demo High GLB, renders it with the same environment into an independent four-sample HalfFloat target, then calls the actual `layer.renderForPreparation(renderer)` in that target. The latter borrows the existing Low fade owner, as the productive High-warm chain does; an unrelated High clone alone would miss owner-cache interference. It fences and disposes the temporary High instance/target. The same first-focus and first-moving check then repeats without rewarming the Low source. This still does **not** prove the complete Stage High/refinement owner graph, which remains a follow-up case.

The final guards start another genuine preparation and invalidate its owner before the fence resolves; stale readiness must remain false. Resizing the source Canvas invalidates its context permanently, including resizing back. All context, catalogue, environment, asset and GPU resources are owned by the fixture and released in `finally`; checkpoint teardown rejects a held phase.

Still open after the completed matrix: DPR 1.5/2, resize then successful reprepare plus pixel comparison, explicit renderer exceptions in the Catalog GPU chain, arbitrary transmission/custom node materials, a full Stage High/refinement intervention, and scratch linear/depth witness comparisons. Matching the actual displayed scene against a separately prepared legacy layer is now covered at 960 × 640, DPR 1, as recorded below. This does not close the broader internal-image or lifecycle questions. No frame-time or total Stage-memory improvement follows from creation counts.

After a coordinated package/demo build, the single isolated test command is:

```powershell
npx.cmd --no-install playwright test --config playwright.catalog-warm-output.config.ts
```

The config owns port 4207. It saves every Background PNG, incremental `background-checkpoints.json`, and final or partial `catalog-warm-output.json`. A negative resource/readiness/pixel result remains a failure; thresholds are not widened to make the experimental context appear compatible.

Initial source preparation checks: the strict TypeScript check of the proof, E2E and config passed against the new Core source via a temporary path-alias config; the Svelte route compiled for client and server without warnings; Playwright listing found exactly one case. These checks alone establish no pixel/resource result.

The first browser run on demo 53394 / runtime 6b3a6b1 / proof c7424ec (runner 82703) failed and remains under `.artifacts/catalog-warm-output-53394-c7424ec`. All four List Background screenshots had retained error 0 and spatial RGB range 192. At the following `frosted/source` checkpoint, the rectangle assertion correctly rejected a 960 × 640 preview instead of 240 × 160. The fixture's preceding resize guards used `CanvasTarget.setSize()` with its default `updateStyle=true`, overwriting the independently declared preview CSS extent. Both guard calls now explicitly use `false`; the actual output resize/invalidation remains unchanged. No image crop, equality threshold or resource assertion is weakened.

The run ended before final GPU/readiness rows were exported, so it does not establish that the List resource/readiness assertions passed. A read-only evidence snapshot is now exposed at each checkpoint and included if the harness exits early, preserving already collected rows and phase-labelled GPU calls. The corrected complete observations follow below.

## First complete observations: build 64392 / ed98ea3

Runtime `6b3a6b1`, run `26290`, **exit 1**. All three case rows were captured in
`.artifacts/catalog-warm-output-64392-ed98ea3`. The preview resize defect from
build `53394` is fixed; the original failed run remains archived separately.

List, frosted Carousel and glass Carousel all preserve the actual nonuniform
Background (RGB range 192) exactly through no-op, scratch warmup and High
intervention. All twelve checkpoint PNGs have the declared 240×160 bounds.
No implicit Background target is created; synchronous renderer/target restore,
ready-after-fence, stale-fence rejection and resize invalidation all pass.

| GPU creation phase | List | Frosted Carousel | Glass Carousel |
| --- | ---: | ---: | ---: |
| First Focus after scratch | 0 | 0 | 0 |
| First Moving after scratch | 0 | 0 | 0 |
| Focus after High / Low-fade preparation | 0 | **1 buffer** | **1 buffer** |
| Moving after High / Low-fade preparation | 0 | 0 | 0 |

The buffers are labelled `bindingBuffer68_object_(vertex,fragment,compute)` and
`bindingBuffer145_object_(vertex,fragment,compute)`. No shader, pipeline or
texture creation accompanies them. GPU-validation and page-error arrays are
empty. These buffers still violate the unchanged zero-creation gate; the suite
is not accepted. Whether the same intervention also affects the legacy warm
path and which owner rebuilds its bindings require further attribution.

The subsequent source/CPU attribution identifies a pre-existing Fog mismatch in
`CatalogSpatialElementLayer.renderForPreparation()`: it rendered Carousel meshes
using the List scene fog. Productive Carousel draws explicitly use no fog.
Installed Three includes the fog node in its dynamic cache key, so this replaces
the same mesh/material/context render owner and releases its bindings. A change
between ordinary perspective cameras alone does not change that key. The new
`catalogPreparationOwners.spec.ts` uses actual installed `RenderObjects` and
`NodeManager` classes to reproduce the old replacement without any scratch
context, and verifies the separated List/Carousel draw variants preserve owners.
The focused 27-case run and Core typecheck passed; the actual GPU regression was
pending at that source checkpoint and is recorded in the following section.
The fixture added a distinct `warm-mode=legacy` control as well
as scratch: both require zero first-use creations. Exact Background retention and
no implicit allocation remain mandatory for scratch; the legacy Canvas path's
pixels/allocation are recorded separately and are not certified as offscreen.

## Fog correction verified: build 45725 / 4e99674

Run `22536` completed **2/2 cases, exit 0**, one scratch and one separate legacy
control, on runtime `4e99674` / fixture `e39ff28`. Artifacts are retained under
`.artifacts/catalog-warm-output-45725-4e99674`. Both modes cover List, frosted
Carousel and glass Carousel. All **24 measured Focus/Moving resource windows**
(before and after High intervention) now contain zero GPU creations. The
previously failing two Carousel buffers are absent without an extra Low rewarm.

Scratch additionally retains all twelve Background checkpoints exactly with
source range 192, and never creates an implicit Background buffer. Both modes
pass readiness, synchronous restoration, stale fence and resize guards, with no
GPU-validation or page errors. The legacy control expects its existing implicit
Background allocation and does not certify retained pixels. The earlier failing
rows remain evidence; neither their counts nor the zero-creation gate changed.

The package build `69098` and full unit run `91566` also pass on this source
checkpoint (**1052 tests in 126 files**). This establishes the isolated Low-owner
compatibility boundary. Full Stage integration, linear/depth target-image parity,
bounded shared-output memory and unprofiled navigation pacing remain separate.

## Combined owner and displayed-scene protocol

The fixture additionally supports `warm-mode=borrowed`, using the real
`BackgroundLayerOutput` target through `createBorrowed()` instead of allocating
an independent scratch target. It checks exact target identity, refused
publication after scratch writes, source retention, all first-use creation gates,
and the same fence/resize rules. The separate retained source texture is an input
to complete output composition, not an extra scratch attachment.

Each mode now pauses at the actual first Focus/Moving draws before and after
High. Screenshots retain the full 960×640 scene with its real DOM overlays; only
the independent Background diagnostic preview and status label are hidden for
these scene comparisons. The unchanged Background checkpoints remain separate.
A following serial case compares all 24 scratch/borrowed images against legacy
with zero channel tolerance. A movement witness below the diagnostic overlays
requires actual changed scene pixels. This adds displayed-image compatibility,
not a readback assertion on every internal depth attachment.

## Borrowed owner and displayed scenes verified: build 13943

Borrowed runtime `6f2c7eb`, proof `be63a54`, run `88391`: **4/4 tests, exit 0**.
The preserved [artifact directory](../../../.artifacts/catalog-borrowed-scene-13943-be63a54)
contains one result/checkpoint set per mode and a separate
`productive-scene-comparison.json`. `.last-run.json` reports `passed` with no
failed tests. All three result files have empty GPU-validation and page-error
arrays.

The three modes are `legacy`, independent `scratch`, and `borrowed`; each tests
one List actor, a two-actor frosted Carousel and a two-actor glass Carousel.
For each of these nine rows, first Focus, first Moving, Focus after High and
Moving after High contain **zero entries in all five GPU-creation categories**:
36 measured resource windows in total. Warmup itself still creates resources,
and the raw phase-labelled calls remain in the artifacts:

| Warmup creation calls | List | Frosted Carousel | Glass Carousel |
| --- | ---: | ---: | ---: |
| Legacy | 15 | 44 | 47 |
| Independent scratch | 13 | 47 | 50 |
| Borrowed output target | 10 | 44 | 47 |

These are counts for those labelled preparation windows, not total memory or
speed comparisons. No Low rewarm was added between the real High/Low-fade
intervention and the measured follow-up Focus/Moving windows.

All nine rows start unready, remain unready before the real GPU fence and become
ready afterward. Synchronous renderer state and target viewport/scissor restore
pass. Both real focus events and capture/freeze requests are observed. Stale
fence, resize and resize-back rejection pass for all rows. Only the legacy mode
is ready when queried without an explicit context profile.

In all three borrowed rows, `sharedOwnerTarget` and
`scratchPublicationRejected` are true: the context uses the real owner's target
and cannot publish its destructive warmup pixels. The source input remains a
different texture. Both offscreen modes keep `backgroundImplicitBefore` and
`backgroundImplicitAfter` false. Legacy records its existing implicit output
allocation and is not certified as an offscreen retention path.

Each offscreen mode retains twelve 240 × 160 Background checkpoints exactly:
source, no-op, after warm and after High for each of the three kinds. All 24
checkpoint differences are zero and every source's spatial RGB range is 192.
Legacy also records twelve checkpoints, including changed-pixel errors of 192;
those changes remain visible in the evidence and are not interpreted as passes
for Background retention.

The separate displayed-scene result has **24 exact comparisons**, all maximum
RGBA-channel error zero at 960 × 640: scratch and borrowed against legacy,
across three kinds and the four Focus/Moving checkpoints before/after High.
These are actual Rear/Foreground Canvas pixels with their live DOM overlays;
only the independent Background diagnostic preview and status are hidden.
They are not screenshots of an empty substitute scene. Below the diagnostic
overlay area, the Focus-to-Moving witness changes by 184 channel units for List
and 182 for both Carousels in every mode. A visual check of the borrowed glass
Moving PNG also confirms the foreground model, rear model, ground shadow and
glass surface are present.

This closes the isolated resource, shared-storage ownership, retained-Background
and displayed-scene gates for this specific matrix. The independent High
intervention is still not the complete Stage refinement lifecycle; no new claim
is made for internal depth-image equality, other DPRs, arbitrary shader inputs,
production cancellation/resize sequences, total Stage allocation or unprofiled
navigation pacing.
