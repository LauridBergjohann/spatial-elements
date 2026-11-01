# Isolated Background-layer output proof

Status: **protocol v4 passed** on demo build `91647` / proof revision `b5a522a`, using runtime `960483f` (run `62798`, exit 0). The integer-bound fixture preserves strict full-image equality. The earlier v2 success, v3 observation failure and first v4 clip failure remain documented below. This remains an experiment; production integration depends on the evidence and ownership gates, not additional user permission. No production rendering path selects its candidate.

The experiment asks whether the existing opaque Background canvas can accumulate its ordered linear draws in one explicit target, then perform the output transform once. It does not combine the Background, Foreground or Carousel Rear layers, change glass sampling sources, cache model pixels, or batch GPU submissions.

## Completed v4 checkpoint

Artifacts: `.artifacts/background-layer-output-v4-91647-b5a522a`, including the
complete JSON, 32 checkpoint PNGs, two Frosted screenshots and the runner log
beside the directory. The source remains nonuniform (RGB ranges 220 / 225);
all screenshot bounds and full image dimensions match the declared 160×120 and
200×144 CSS rectangles exactly. No pixels are cropped or ignored.

- All 18 linear/immediate Canvas matrix pairs have exact error 0; six eligible
  glass cases use 6 rather than 10 submissions. Fallback counts are unchanged.
- Both independent readback controls and all four transparent-clear cases pass
  exactly. Clear submissions remain 2 / 2, with restored renderer state.
- All 14 accepted source/hold/offscreen/incoming/clear screenshot pairs are
  exactly equal. No-op, held content-only and offscreen preparation preserve
  each source exactly across fence and paint. Incoming pixels are visibly different.
- The two **unaccepted masked-publish diagnostics** still lose the source:
  candidate error 220 / 225, candidate spatial range 0, reference unchanged.
  Passing the suite does not approve that path; it records this negative result.
- The candidate never acquires an implicit Background target in all 14 recorded
  lifecycle observations. Public disposal removes the reference allocation.
- Injected-failure restoration, recovery and the actual Frosted DOM comparison
  pass (maximum screenshot channel error 0); GPU and page errors are empty.

This establishes isolated output compatibility and the offscreen retention path,
not production ownership, first-use readiness or a navigation pacing improvement.

## Reference and candidate

The route `/proof/background-layer-output` uses the actual `StageRenderPipeline` and `LiquidGlassPanel` implementations. A nonuniform HDR scene capture and the pipeline's separate blur captures are prepared once per size. Both paths read those same textures. One regular glass panel uses the stage camera; an overlapping minimap glass panel uses its own off-axis camera. Their depth clears and rendering order come from the unchanged `renderBackgroundPanels()` method. Small depth-tested witnesses inside those groups make the depth-clear ordering observable.

The reference calls `renderStageDisplay()` and `renderBackgroundPanels()` on a CanvasTarget. The candidate draws the same linear stage-display quad and the same panel sequence into a separate RGBA16F target with four MSAA samples and depth. A public Three `RenderPipeline` samples that target with `screenUV` and applies the final output transformation. The target is never a glass input, so the experiment introduces no read/write feedback with `sceneCapture` or its blur textures.

The final transformation remains Three's `RenderOutputNode`: unpremultiply, tone mapping, output color conversion, then premultiply. The candidate does not convert intermediate results to eight-bit color or mix already tone-mapped images. Its public renderer state is restored in `finally`, including canvas/targets, viewport/scissor, clear values, automatic-clear flags, tone mapping, exposure, output color space and XR enablement.

Frosted panels have a native CSS surface in this framework, not a GPU Frosted material. The fixture therefore also renders two actual Svelte `Panel surface="frosted"` components over the resulting canvases. A minimal registration context avoids instantiating an unrelated second Stage renderer. The final DOM screenshots test the real backdrop-filter, tint, rounded surface and text. No substitute Frosted shader is introduced.

## Linear readback and output comparison

The linear comparison uses public `copyFramebufferToTexture`, `copyTextureToTexture` and `readRenderTargetPixelsAsync` APIs with a HalfFloat readback attachment. In the installed Three r186 source, a framebuffer copy outside a render call uses the explicitly bound target or, for a Canvas, its current linear intermediate. The reference's copy therefore observes the linear framebuffer after the ordered panel draws; the candidate's copy observes its explicit linear target. The experiment requires HDR values above one to remain present and compares decoded half-float channels exactly.

Three's WebGPU `copyTextureToBuffer()` returns mapped data with 256-byte row alignment; it does not repack the rows. Protocol v2 validates the exact buffer length `(height - 1) × alignedRowBytes + width × 8`, then extracts exactly `width × height × 4` HalfFloat channels. At 300 × 216 physical pixels, each 2400-byte row has a 2560-byte stride, and the returned 276400 values include 17200 padding values. Padding is never interpreted as pixel alpha. A separately cleared HDR attachment with distinct exact RGBA values `[0.25, 0.5, 2, 1]` verifies the complete copy/readback chain at both physical sizes, independently from reference/candidate agreement. Pure decoder tests poison padding and use different values for every row/channel.

An opaque Background canvas does not imply that its linear intermediate alpha is always one. Real `LiquidGlassPanel` uses additive blending for its sheen; Three's WebGPU additive alpha factors are One/One. Thus linear alpha may exceed one before `RenderOutputNode` clamps it. Protocol v2 retains exact four-channel reference comparison, records both paths' alpha extrema, and requires alpha one only when the panels are hidden. No pixel tolerance is widened.

`Scene.onAfterRender` is not used as a supposed pre-output hook: in this Three version it is invoked **after** `_renderOutput`. No private renderer field is read or mutated to obtain the linear image. Access to the existing WebGPU device is confined to the diagnostic submit counter, error scopes and queue fence. The counter immediately forwards the same command buffers to the original `GPUQueue.submit`; it never delays or combines submissions. Protocol v3's separate allocation diagnostic only reads presence in the version-specific `_frameBufferTargets` Map, as described below.

Immediate Canvas output is copied synchronously into a 2D canvas and compared independently from the linear data. This observation must happen in the publishing task: it is not a valid displayed-pixel readback after presentation. Lifecycle retention and the actual Frosted DOM surfaces use separate Playwright locator screenshots, decoded in Node without drawing into any browser canvas. All advertised comparisons require exact equality; a failure must be diagnosed rather than silently widening the tolerance.

## Cases and boundaries

The eighteen rows cover six output configurations at panel opacities zero, one quarter and one:

- Initial and repeated output at 160 × 120 CSS pixels, DPR 1.
- Resize to 200 × 144 CSS pixels, DPR 1.5, including sharp and blurred backdrop targets at their production densities.
- A partial viewport, active scissor and nonstandard clear depth. These three deliberately use the unchanged Canvas path for the candidate as conservative fallbacks. Their equality does **not** establish that the new explicit-target path supports those configurations.

Before each output, a magenta near-plane seed poisons existing color/depth so a missing clear is observable. Each exact rendering configuration is warmed and fenced before its measured repetition. The reported count covers only the ordered output sequence, excluding the seed, warmup and readback.

For eligible full-viewport cases with visible regular and minimap panels, protocol v2 measured four fewer submissions: the reference performs four intermediate Canvas output transforms after the two depth clears and two panel draws; the candidate keeps those linear passes but performs the output transform once at the end. With no visible panels there is no saving. Fallback counts match. These are submission counts, not a frame-time claim.

A deliberate exception after the candidate's panel draws checks renderer-state restoration and a subsequent successful redraw. The test also records WebGPU validation/uncaptured errors and browser errors. Targets, textures, materials and the renderer remain owned by the fixture until its DOM comparison completes, then are disposed when the route unmounts.

Protocol v2 covers a filled Background with an opaque stage-display fragment and varied glass opacity. Protocol v3 adds an empty transparent clear only; neither establishes arbitrary transparent-layer composition, Foreground/Rear output, custom nested renderer callbacks, arbitrary GLTF transmission contexts or production readiness. A future integration needs its own resource lifetime, idle warmup, resize/cancel and memory review.

## Protocol v4 lifecycle checkpoints

Fresh reference/candidate CanvasTargets exercise initialization without the matrix's deliberate Canvas poisoning, at 160 × 120 / DPR 1 and after resize to 200 × 144 / DPR 1.5:

1. The first output is a transparent content-only clear. The reference calls the actual `StageRenderPipeline.renderFrame(true, false)`; the candidate clears its explicit target and publishes once. Every decoded linear and Canvas channel must be exactly zero, and both should submit twice.
2. Both publish the filled source. After GPU completion and two RAFs, Playwright captures the actual displayed canvases. Each screenshot must have a spatial RGB channel range greater than 20; a constant colored image does not satisfy this control. No later warm phase is released against an empty baseline.
3. A second fence/two-RAF checkpoint performs no rendering and must preserve each source screenshot exactly. Content-only rendering with `outgoingBackground` set follows at its own checkpoint, again with exact retained pixels and zero submissions.
4. Real scene/blur sources are changed to a distinctly different incoming HDR image. The candidate prepares its actual stage-display and glass passes offscreen without publishing. Its prepared linear pixels must change. After a fence/two RAFs, both displayed outgoing canvases must still match their own baseline exactly.
5. A separate masked-output warmup exercises the final RenderPipeline with zero-area Canvas scissor. Its exact screenshot error and `preserved` result are recorded as a **diagnostic candidate**, with `acceptedRetentionPath: false`. It is not part of the advertised no-publication retention contract and may fail independently. The untouched reference must remain exact. A passing overall proof must not be described as establishing masked-publish retention unless this separate result also has error zero.
6. Incoming content is published normally, then captured at another fence/two-RAF checkpoint and compared exactly against the reference. Both must visibly differ from the outgoing source. A final transparent clear must again zero all real linear/immediate Canvas channels and match the initial clear's compositor screenshots.

The query `?lifecycle-checkpoints=1` enables the fixture-only handshake. Each phase exposes a monotonically increasing ID, name and dimensions. One ID-specific release advances it; stale or duplicate releases cannot unlock a later phase. Unmount rejects the pending wait. The getter/release functions perform no rendering or pixel copy. The test records all sixteen phase observations and 32 raw PNGs across the two sizes before applying the retained-pixel assertions; a failed source positive control is saved immediately and stops before warmup. PNG decoding supports Chromium's non-interlaced 8-bit RGB/RGBA output and all five scanline filters; its channel/range comparisons run entirely in Node. This avoids touching the WebGPU canvas while measuring displayed retention.

The lifecycle pair uses a separate white screenshot surface at integer CSS coordinates. The harness records both Canvas rectangles and PNG dimensions and requires exact integer positions and the declared CSS extent. Its initial transparent-clear screenshots must be spatially uniform. These checks prevent fractional locator clips from adding neighboring content; they do not crop the measured image or relax any pixel comparison.

The allocation diagnostic reads only Map membership for `_frameBufferTargets` in installed Three r186. `Renderer.js:463` constructs a `Map`; its getter uses `.get` at line 1571, inserts at line 1601 and deletes on target disposal at line 1595. The proof validates `Map` and a callable `has`, then invokes the builtin `Map.prototype.has` with that map. It never calls the allocating `_getFrameBufferTarget()` method, obtains a private target, changes the map, or disposes an internal target directly. Missing/unknown diagnostic shape throws instead of reporting success. The reference is a positive control: its ordinary Canvas output must create an implicit entry. The candidate must have none after clear, scene/panel publication, readback, offscreen/masked warmup and resize. Public CanvasTarget disposal must remove the reference entry. This proves only the isolated sequence; production catalogue preparation still needs the ownership treatment in the integration sketch.

## Memory accounting

The JSON reports the explicit target's physical size and logical attachment budget separately: 8 bytes per pixel for resolved RGBA16F, 32 bytes for four-sample color, and 16 bytes for four-sample Depth32. This is approximately 76.9 MiB at 1440 × 1000 physical pixels, before optional depth resolve and driver overhead; doubling both dimensions multiplies that budget by four.

The proof intentionally retains both paths, so its target is additional memory. It does not claim that the existing internal Canvas framebuffer is reused or released. The shared scene/blur sources, readback targets and other proof resources are outside this stated candidate budget. A production design would have to measure any replacement versus addition explicitly.

## Execution and evidence

After a coordinated package/demo build, the isolated command is:

```powershell
npx.cmd --no-install playwright test --config playwright.background-layer-output.config.ts
```

The config owns port 4205 and writes `.artifacts/background-layer-output`. The test saves the complete row JSON before asserting pixel/count results, the incremental `lifecycle-dom-checkpoints.json` and raw phase PNGs, plus both Frosted PNGs and their channel comparison. Immediate buffer values and compositor observations are named separately in protocol v4.

Preparation checks on 2026-11-01: `npm run check --workspace @spatial-elements/demo-sveltekit` completed with zero errors and zero warnings; `playwright test --config playwright.background-layer-output.config.ts --list` loaded exactly one test.

The first run's complete raw JSON and trace remain under `.artifacts/background-layer-output-10026-7d373ab`. All 18 rows reported exact agreement for both complete readback arrays and Canvas output, with no GPU validation/browser errors and restored state. Eligible visible-panel cases submitted 10→6 passes, hidden-panel cases 2→2, conservative fallbacks 4→4 or 12→12. The runner nevertheless exited 1 because the extra `linearAlpha === 1` assertion was invalid for real additive glass. The Frosted DOM comparison was not reached. DPR 1.5 statistics also included readback padding in that first run; those extrema are not valid pixel-only extrema and are preserved as failed-protocol evidence, not reclassified as a passing test.

The v2 decoder's three CPU cases pass, the demo typecheck reports zero errors and zero warnings, and the Playwright listing loads the single test. Root executed the rebuilt v2 GPU proof on demo 39337 / a94344e: runner 10738 exited 0, one test passed. Complete evidence is preserved under `.artifacts/background-layer-output-39337-a94344e`.

| v2 observation | Result |
| --- | --- |
| All 18 linear RGBA and Canvas comparisons | Maximum channel error 0 |
| Independent HDR control at 160 × 120 and padded 300 × 216 | Maximum channel error 0; exactly 76800 / 259200 real channels decoded |
| Six eligible visible-glass rows | 10 reference submissions, 6 candidate submissions |
| Three eligible hidden-glass rows | 2 / 2 submissions |
| Three hidden and six visible conservative fallback rows | 4 / 4 and 12 / 12 submissions |
| Renderer state in every row, deliberate exception recovery | Restored; subsequent Canvas difference 0 |
| Actual Frosted DOM screenshots | Maximum channel error 0 |
| GPU validation/uncaptured errors | None |

The corrected readback reports actual linear alpha extrema of 0.998046875 to 1.17578125 across visible glass rows, identical in both paths; all hidden-glass pixels retain alpha one. The DPR 1.5 control confirms exactly 17200 padding values are excluded. The two final Frosted screenshots were also visually inspected. No tolerance was widened and no old failed result was discarded or reclassified.

Protocol v3's first run (runner 22079, build 27554 / 60deaac) remains under `.artifacts/background-layer-output-v3-27554-60deaac`. It failed closed with `Three r186 implicit-target presence diagnostic unavailable`: the fixture incorrectly required a WeakMap, whereas the installed renderer owns a Map. No lifecycle result was produced, so this is neither an allocation failure nor a passing retention proof. Source now checks the actual Map shape; future errors preserve their stack in the result JSON, and the test evaluates the captured terminal state immediately instead of retrying an already terminal error as though it could become ready.

The corrected Map diagnostic ran on build 28778 / eff4f75; raw evidence is under `.artifacts/background-layer-output-v3-28778-eff4f75`. All four transparent clears matched exactly, produced genuinely zero linear/Canvas channels and submitted 2 / 2. All fourteen presence observations found no candidate implicit target; the reference created its entry, and public disposal removed it. The eighteen original matrix rows still had exact linear/Canvas agreement and no GPU errors.

The retention proof nevertheless failed its positive control: after the first ordinary source publication, a GPU fence and two RAFs, `sourceCanvasRgbRange` was zero for both sizes. No warm draw had occurred yet. Later held-pixel differences of zero therefore compare empty Canvas2D observations and are not retention evidence. The prepared offscreen linear image did change (maximum difference 3.3828125 / 3.388671875), and immediate incoming publication again matched exactly, but these facts cannot repair the missing valid displayed baseline. This failed run remains preserved. Actual compositor screenshots at explicit before/after checkpoints, including a no-op paint control, are needed; no tolerance should be widened to bypass the positive control.

Exact linear, Canvas and Frosted DOM comparison limits remain zero. No production integration follows from these partial lifecycle observations.

Before the first v4 run, four CPU cases passed for the PNG decoder and phase ownership; the demo reported zero Svelte errors/warnings; the isolated strict TypeScript check of the E2E, shared PNG helper and checkpoint API passed; Playwright listing loaded one case. These source checks do not validate displayed retention.

The first v4 browser execution (runner 37588, demo 11873 / 8f726a1) failed and is preserved under `.artifacts/background-layer-output-v4-11873-8f726a1`. All sixteen checkpoints were captured. The trace records the first lifecycle pair at `top=233.875`, directly below the earlier matrix canvases ending at that same fractional coordinate. PNGs are therefore 160 × 121 rather than 160 × 120; the resized pair is 200 × 145 rather than 200 × 144. An offline localization of initial-clear, published-source and published-incoming comparisons at both sizes finds every differing pixel in row zero, with maximum channel error 81. That row contains the preceding output; its horizontal offset differs between the two clips. The full screenshots remain failing data: no pixels were discarded and no result was reclassified as a pass. The fixture correction places the complete lifecycle surface at integer coordinates and adds the extent/uniform-clear checks described above.

The same run supplies independent, useful observations despite that cross-canvas clip defect:

| v4 observation on 11873 | Recorded result |
| --- | --- |
| All 18 linear/immediate Canvas matrix comparisons | Exact error 0, GPU errors empty |
| Four transparent clears | All real linear/immediate Canvas channels zero; 2 / 2 submissions |
| Candidate implicit-target observations / public disposal | No candidate implicit target; reference entry created and removed on disposal |
| Source screenshots | Nonuniform, spatial RGB ranges 220 and 225 |
| No-work, held content-only and offscreen warm, each against its own source screenshot | Exact retained error 0 in both canvases at both sizes |
| Offscreen prepared linear change | Maximum difference 3.3828125 / 3.388671875; renderer state restored |
| Masked final-output publication | Candidate differs from source by 220 / 225 and exactly matches its initial transparent clear; untouched reference retained with error 0 |
| Subsequent normal incoming publication | Linear/immediate Canvas error 0; displayed image visibly changed; cross-canvas screenshot difference remains confined to the unrelated first row |

The masked-publication result is an actual compositor observation of source loss, not the earlier invalid Canvas2D inference. It remains a negative diagnostic candidate and must not be used as an invisible warmup. Pure offscreen preparation leaves the presented image unchanged in these recorded phases. The overall proof remains failed until a fresh complete run with valid clips passes; Frosted DOM comparison was not reached in this run.

## Preliminary integration decision

The measured ordered-output count supports investigating a Background-only integration after the complete corrected pixel/DOM proof passes: four saved submissions per frame with the two glass passes, without moving glass sampling, model rendering or depth clears. It proves no frame-time benefit; that requires a separate unprofiled comparison.

Memory is the decisive integration constraint. A full-size explicit target must replace the implicit Background framebuffer rather than silently coexist with it. In the installed Three version, a Canvas `clear()` or draw under ACES/sRGB may allocate that implicit framebuffer. Current `renderFrame(contentOnly)`, `freezeBackground()`, `warmRenderTargetSets()` and `warmRevealFrame()` all contain such Background paths; replacing only the ordinary detail-frame output would therefore retain both allocations. There is no public API for borrowing or retiring one private intermediate while keeping its owner unchanged. The safe design must cover the Background layer from its first clear onward, including warmup, outgoing snapshot and content-only clear, or explicitly abandon and dispose the candidate when a conservative fallback is chosen. The existing sceneCapture and blur targets remain separate. Initialization, ownership, warmup readiness, fallback lifetime, resize and total attachment memory require review before production integration.
