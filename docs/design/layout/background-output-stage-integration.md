# Query-gated Background output integration

This checkpoint connects the existing `BackgroundLayerOutput` and borrowed catalog warm context to the real Stage, **only** when both `stage-test=1` and `stage-background-output=1` are present. It does not enable the candidate by default, change a public authoring API, establish GPU equivalence or claim improved navigation pacing.

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

Focused CPU tests cover the exact query gate, initial output preparation, normal/content/freeze routing, unpublished reveal warming, outgoing resize/retention, terminal fallback while held, cached context ownership and read-only diagnostics. They establish call order and state/lifetime rules using the actual output owner. Real Stage pixel retention, absence of implicit Background allocation, first Moving/Reveal GPU resources, ordinary navigation/Back/cancel/zoom behavior and unprofiled pacing remain separate GPU/browser gates. The unchanged default path remains available throughout this experiment.
