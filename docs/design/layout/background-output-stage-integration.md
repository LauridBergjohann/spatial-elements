# Query-gated Background output integration

This checkpoint connects the existing `BackgroundLayerOutput` and borrowed catalog warm context to the real Stage, **only** when both `stage-test=1` and `stage-background-output=1` are present. It does not enable the candidate by default, change a public authoring API, establish complete Stage image equivalence or claim improved navigation pacing. The first five real Stage browser cases now pass on the revision described below.

## Lifecycle and call sites

`StageExperience.init()` calls `StageRenderPipeline.initializeBackgroundOutput()` after successful renderer initialization and its disposed check, before mounting the Background Canvas or loading/drawing scene content. The hook sets the actual Canvas dimensions/DPR, creates one output owner and prepares its final output with an ordinary transparent clear/publication. No source pixels exist at that point. Repeated initialization cannot create another owner.

The pipeline routes complete frame, outgoing freeze and Full/Scroll warm compositions through the same display-plus-panels owner. Content-only frames use that owner's transparent clear. Reveal warm-up composes with `publish=false`; it neither publishes nor issues a masked Background Canvas draw while the explicit owner remains valid. Foreground/minimap and carousel-rear ownership remain unchanged.

A retained outgoing Canvas is never published or resized. Full/Scroll warm-up may rebuild the offscreen output target without publishing it. If the explicit owner declines during that hold, the optional Background warm draw is skipped: a masked legacy Canvas draw is not a safe substitute for retained pixels. Once the hold ends, the next publishing entry (normal frame, freeze or Full/Scroll warm-up) catches up the Canvas/owner size before capturing its outer renderer-state snapshot, preventing restoration of the obsolete viewport.

Scene/blur target replacement does not dispose the output owner. Resize changes the same output target and invalidates the cached catalog context. Stage disposal releases the context before disposing its output owner. An unsupported output profile or failed output composition selects terminal fallback, disposes the explicit allocation and invalidates the context; this pipeline instance never recreates an explicit owner afterward.

## Catalog preparation and readiness

Preparation and source eligibility explicitly acquire `ensureCatalogWarmOutputContext()`. It caches one `createBorrowed()` context over the output owner's handle, without a second scratch allocation. The same context/profile is supplied to `needsStagedPreparation`, `prepareStagedNavigation` and `isStagedDetailReady`. Existing synchronous restoration, fence and source-generation rules remain in the catalog implementation. Held output blocks catalog preparation rather than silently reverting to Canvas warming.

Diagnostic `getCarouselStats()` uses only `peekCatalogWarmOutputContext()`. Reading diagnostics cannot create a lease/context, trigger terminal fallback or dispose storage. The existing target inventory includes the output target once; the context contributes no additional target.

The DeferredScroll no-write shortcut is conservatively unavailable in the experiment. Its existing ordinary path remains unchanged. The candidate uses complete Full/Scroll preparation instead; a future shortcut must separately bind the output owner's identity, mode and generation in addition to its existing material/scene checks.

## Observable evidence and remaining gate

`getVisualTestRenderTargetStats().backgroundOutput` reports requested/initialized state, owner mode/generation/size, content validity, busy status, borrow/publication counters, retained `held` state, output `targetTextureId` and the cached catalog profile/current result. With both flags active only, `implicitBackgroundTarget` uses a read-only `Map.prototype.has` check against the installed Three framebuffer map. Unsupported map shapes report `null`; no creating lookup is used. Existing Canvas attachment estimates are not repurposed as proof of missing implicit storage.

Focused CPU tests cover the exact query gate, initial output preparation, normal/content/freeze routing, unpublished reveal warming, outgoing resize/retention, terminal fallback while held, cached context ownership and read-only diagnostics. The checkpoint `ceeef8f` has 174 focused CPU tests and a passing Core typecheck; these establish call order and state/lifetime rules using the actual output owner.

The [separate Stage browser proof](background-output-stage-proof.md) is now **5/5, exit 0** on runtime `ceeef8f` / proof `1235e47`, demo `84797`, run `71682`. Its 23 explicit snapshots and 18 phase observations all retain an explicit owner, one stable output texture identity per case and no observed implicit Background target. The inventory includes that texture once in every snapshot. All five Moving windows and all three completed Reveal windows retain the existing zero-creation gate across the five instrumented GPU methods.

Held Back from both List and Carousel preserves nonuniform published Background pixels exactly across real paint opportunities: full 1440 × 1000 screenshot pairs have spatial ranges 205/217 and maximum RGBA error zero. Publication and borrow counters stay fixed during each hold; after release the catalog regains borrowed readiness. The Low-only case keeps High blocked through actual scrolling and zoom/minimap use, witnesses the conservative two-quality-set warmup rather than the disabled shortcut, and resizes the same output texture to 1280 × 900. Separate Escape and resize aborts preserve the same live textarea/value, restore input and catalog readiness, and leave no staged hold. Full evidence and build-exit provenance are recorded in the linked proof.

This closes the tested Stage ownership, retained-Background and first-use resource boundaries at DPR 1. It does not establish complete legacy/candidate image parity, continuous allocation monitoring, total GPU memory, all responsive layouts, physical-device behavior or unprofiled pacing. The JSON `pageerror` arrays are empty; this suite does not introduce a separate GPU-validation error scope. Subsequent full regression and performance gates remain revision-bound. The unchanged default path remains available throughout this experiment.
