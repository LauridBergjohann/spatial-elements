# Background output: isolated Stage integration gate

This is a functional, query-gated integration check. It does not enable the new
output path for ordinary applications or establish a latency/frame-pacing result.
The candidate requires **both** `stage-test=1` and `stage-background-output=1`.
`stagedNavigation=1` additionally exercises the existing early-navigation path.

The preceding isolated Background owner and Catalog warm-output proofs remain
separate evidence. Passing their pixel/resource comparisons does not imply that
Stage ownership, outgoing retention, scrolling or cancellation also passes.

## Five initial cases

1. List to the real demo detail, then Back with destination binding held.
2. Carousel to the same detail, then the same held Back.
3. A real List to Low-only detail, with High deliberately blocked through the
   Full/Scroll preparation fallback, actual scrolling, zoom, reset and resize.
4. A slow Carousel navigation cancelled with Escape before destination mounting.
5. The same source cancellation caused by a viewport resize.

The held cases use the existing query-gated page-binding control. They compare
two real DOM screenshots of the published Background Canvas over paint
opportunities, with all sibling layers hidden only for those screenshots. This
does not draw/copy a WebGPU Canvas into Canvas2D. The source must contain spatially
nonuniform pixels; exact RGBA equality is required. Publication and borrow counts
must stay unchanged while the outgoing Background is held. Afterwards the
destination must become usable and the catalog must regain actual readiness.

## Ownership and resource gates

Every explicit checkpoint requires an active `explicit` owner, one unchanged
output texture ID appearing exactly once in the target inventory, and no implicit
Three Background target. The latter is a **read-only**, doubly query-gated
`Map.prototype.has` diagnostic. Missing/unknown diagnostics fail; they do not mean
that allocation is absent. Source readiness must use a `leased-canvas:` profile
and record an actual borrow. The observer records owner state only at staged
phase changes, not on every animation frame.

The five existing GPU creation categories are observed through transparent
prototype wrappers, as in the existing staged-navigation acceptance harness.
The completed forward cases require zero creations throughout Moving and the
exact `revealStarted` through `revealEnded` interval. They preserve the existing
zero-creation threshold; binding work outside those intervals remains recorded.
Cancelled cases still require zero creations during their actual Moving phase.

Resize may change generation and physical dimensions, but must retain the same
owned target/texture object. No test silently accepts terminal Legacy fallback.
The experimental owner deliberately declines the old no-write deferred-Scroll
shortcut. Its Low-only case must therefore witness exactly two new ordinary
quality-set warm draws (Full and Scroll), unchanged `inactiveScrollWarmups` and
restored Full `activeScale=1`. It also requires a real blocked High request, a Low
hero before/after zoom and new minimap render passes. This verifies the explicit
conservative fallback, not compatibility with the deferred-Scroll shortcut.

## Run and artifacts

After the coordinated package/demo build, with an exclusive browser slot:

```powershell
npx.cmd --no-install playwright test --config playwright.background-output-stage.config.ts --output .artifacts/background-output-stage-<build>-<revision>
```

The separate preview uses port **4208**. Each case writes
`background-output-stage.json`, including all observed GPU calls, phase
checkpoints, owner/target snapshots, timings, errors and the final render
activity. Held Back additionally saves both unmodified PNGs and their exact
comparison. No retry, sample discarding or performance-gate change is part of
this suite.

## Current status and limits

Source TypeScript and Playwright listing (five cases) pass; no browser result is
claimed yet. This first matrix is
1440×1000 at the configured browser DPR, with one resize to 1280×900. It does not
cover all breakpoints, device loss, arbitrary application-owned materials or
renderer callbacks, High-to-Low refinement image equivalence, fullscreen, or
memory/latency acceptance on other hardware. Those limits remain explicit even
if these five cases pass.
