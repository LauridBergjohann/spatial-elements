# Isolated four-endpoint pixel proof

Status: the initial native-WebGPU run **refutes bilinear equivalence for the unchanged production renderer**, including opaque materials. A separately labeled single-premultiplication control passes all numerical comparisons, but refutes its alpha=1 assumption for transmission. Protocol v2 then **passes the actual production overlay comparison** with that fixture-only cover correction. No corrected-runtime run or production cache has been evaluated here.

The proposed narrow optimization concerns the staged Hero while its camera, pose, materials, lighting and animation inputs are held. It does not apply to arbitrary NodeMaterial/custom shaders, time-dependent effects, framebuffer-dependent blending, changing geometry, or unvalidated scenes. Resize/projection/refit, Low/High asset generation, environment, background/tint, materials and render-quality changes would invalidate all endpoint pixels. Cancel, back navigation and destroy must retain/release the existing presentation owners independently of a pixel cache.

The independent inputs are `backgroundReveal` (p) and the **already eased** `refinementProgress` (q). The real renderer first renders complete High and Low scenes at p, then mixes those captures linearly at q. Display ACES/exposure/sRGB happens afterwards. In particular, the background cover is drawn before the model, so transmission is tested against the actual renderer; the proof does not assume that the visible background can simply be pasted behind an already rendered model.

`tooling/scene-endpoint-proof` imports the built `StageRenderPipeline.renderStageContents` and `SpatialElementRefinement` through their existing exports. Its reference renders use the actual High-before-Low sequence and explicit q. Endpoint capture calls the scene draw directly and verifies that q, completion, frame count, visibility, environment and camera matrices remain unchanged. It never calls `warmRevealFrame`, the production presentation controller, or a stateful refinement render while collecting endpoints.

Protocol v1 used Refinement's default `NoBlending` mode. Its assumption that a decked background guarantees alpha=1 was **refuted by the transmission cases**; consequently those results cannot establish parity with production's premultiplied overlay. Protocol `scene-endpoint-half-float-v2-overlay` instead uses `SpatialElementRefinement(true)` and applies the identical NormalBlending/transparent/premultiplied NodeMaterial settings to the candidate. Both start from the same deterministic destination, separately tested with white and dark opaque seeds; scene draws retain production's white/alpha1 clear settings. Actual alpha ranges are reported and every alpha channel is compared, with no alpha=1 assumption. The pixel criteria remain unchanged. Original v1 reports and fixture snapshots remain intact.

The existing two Low/High targets retain p=1. Exactly two added RGBA16F resolved-only targets retain p=0; they have no depth, stencil or MSAA. The existing scene-output target is reused for both candidate and reference readback. The proof recreates endpoint contents between comparisons because reference renders overwrite the two existing targets. Extra color storage at the production 512×1024-pixel cap is 8 MiB; this excludes existing targets and renderer-owned material/transmission/environment resources. No production allocation budget is inferred from the proof's small 192×160 viewport.

The candidate is `mix(mix(L0,L1,p),mix(H0,H1,p),q)` in linear HalfFloat space. Cases cover opaque, layered alpha, rough physical transmission, and overlapping/nested transmission, with different Low/High tessellation/materials and environments. Both actual renderer and candidate use the same scene at fixed pose. Each case compares two endpoint controls and four predeclared unequal/interior p/q pairs. Every reference is rendered twice to detect instability.

Before any GPU run the numerical bound is fixed to **max(2^-13, four binary16 ULPs at the larger channel magnitude)** for every RGBA channel. Reports retain max error, RMSE, worst channel, tolerance ratio and number of outliers. No percentage of pixels may fail. The same Three.js ACES/exposure/sRGB shader functions are also applied to both resolved outputs; reports state the maximum difference in encoded [0,1] and 8-bit levels. This supplemental magnitude does not override a linear-space failure. One existing extra target is reused for this display readback, after its endpoint has been consumed. Nonfinite values, unstable reference, changed capture state, additional depth/MSAA targets or failed endpoint controls invalidate the experiment. This is a bounded floating-point equivalence criterion, not a claim of mathematically exact pixels or physical display identity. A failure remains a counterexample at this tolerance; thresholds must not be adjusted retrospectively to make it pass.

Run only in an exclusive GPU slot, after a coherent package build:

```sh
npx vitest run tooling/scene-endpoint-proof/pixelComparison.spec.ts
npx playwright test --config playwright.scene-endpoint-proof.config.ts --output .artifacts/scene-endpoint-proof
```

The standalone Vite fixture needs no Demo rebuild. Browser results are attached as `scene-endpoint-pixels.json`. A passing result can justify investigating a narrow opt-in implementation for these held, standard-material cases only. It cannot establish preparation cost, reveal smoothness, memory lifetime, resize/cancel correctness, compatibility with arbitrary authored models, or general activation; those require separate ownership tests and new performance evidence.

The browser test also writes the JSON to its output directory on success. Set `SCENE_ENDPOINT_RUNTIME` and `SCENE_ENDPOINT_BUILD` to the actually built package revision/build before a run; the report stores these independently of the fixture-control label. The command must use a new output directory for a new protocol/runtime/control. Reports without declared runtime metadata are not corrected-runtime evidence.

## Unmodified-renderer result

The first run used the packages from runtime build 53025 (`02dc683`), Three r186, native Chrome WebGPU. Playwright exited 1 on the declared equivalence assertion. All four material cases completed before assertions. Their endpoint controls are exactly equal, repeated reference renders have zero error, and all capture-state checks pass. Every material case nevertheless fails the interior comparisons. The maximum linear channel difference is 0.3740234375; the maximum encoded display difference across the fixed samples is 84.79248046875 eight-bit levels. Original trace/report remain under `.artifacts/scene-endpoint-proof-initial/` (`report.json` is extracted without changing the recorded values).

For the opaque case, one background pixel has endpoints C0=1.49609375 and C1=1.328125. At p=q=0.5 the bilinear candidate is 1.412109375 but the actual render is 1.0380859375. The latter agrees, within HalfFloat rounding, with **C0·(1−p)² + C1·p**, rather than C0·(1−p)+C1·p. This is a large, deterministic renderer difference, not readback noise or a tolerance boundary.

The installed source explains it: `StageRenderPipeline` explicitly applies `premultiplyAlpha` to the background-cover fragment and also sets `backgroundCoverMaterial.premultipliedAlpha=true`. Three r186's `NodeMaterial.setupOutput` applies `setupPremultipliedAlpha` to that fragment again, which returns `premultiplyAlpha(outputNode)`. Consequently the cover contribution contains its opacity twice. This is a separate existing rendering issue; removing one multiplication changes the intermediate appearance and must not be hidden inside a cache optimization.

## Counterfactual control (not a product fix)

`?coverPremultiplication=single` changes only the proof-owned pipeline's background-cover material: its `setupPremultipliedAlpha` hook returns the existing fragment unchanged. The explicit fragment multiplication and premultiplied blend factors remain. No other material, scene operation, threshold, sample, resource budget or production code changes. The report labels this mode `fixture-only-single-background-cover-premultiplication`; the original mode remains `unmodified-production-renderer`.

Run this control only after GPU-slot coordination, with a separate output directory:

```powershell
$env:SCENE_ENDPOINT_CONTROL='single'
npx.cmd playwright test --config playwright.scene-endpoint-proof.config.ts --output .artifacts/scene-endpoint-proof-single-premultiply
Remove-Item Env:SCENE_ENDPOINT_CONTROL
```

The v1 control completed all 24 comparisons: maximum linear difference 0.0009765625, maximum tolerance ratio 0.75, and maximum encoded difference 0.12451171875 eight-bit levels. Repeated references were exact. The overall test failed its additional alpha=1 guard on both transmission cases; it is **not** a passing production-overlay proof. Its original report/trace and v1 source snapshots remain under `.artifacts/scene-endpoint-proof-single-premultiply/`.

## v2 overlay control result

The recorded v2 control ran on the unchanged runtime `02dc683` / build `53025`, with the explicit fixture-only cover override. It passed all **48** samples: four material cases × six p/q pairs × two opaque destination seeds. Capture state and resource checks pass; every repeated reference is exact. The original unrecorded v2 run also passed; it was repeated only because the standard reporter discarded successful inline-body attachments. The repeat writes its JSON permanently under `.artifacts/scene-endpoint-proof-v2-overlay-single-recorded/`.

| Material case | Maximum linear RGBA difference | Maximum fraction of fixed tolerance | Maximum display difference (8-bit levels) |
| --- | ---: | ---: | ---: |
| Opaque | 0.0009765625 | 0.5 | 0.12451171875 |
| Layered transparent | 0.0009765625 | 0.75 | 0.12451171875 |
| Rough transmission | 0.0009765625 | 0.5 | 0.12451171875 |
| Nested/overlapping transmission | 0.0009765625 | 0.75 | 0.12451171875 |

This establishes bounded equivalence for the tested held scenes with the single-premultiplication correction and the actual overlay blend settings. It does not retroactively pass the original renderer. The production cover correction is a separate change (`ca8e59e`); a newly built runtime must still run this proof **without** the fixture override before serving as corrected-runtime evidence. A scene-cache implementation needs separate ownership, invalidation and performance validation.
