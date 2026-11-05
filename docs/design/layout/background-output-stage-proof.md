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

## Verified Stage result: demo 84797 / ceeef8f

Recorded on 2026-11-05: runtime `ceeef8f`, browser proof `1235e47`, demo build
`84797`, run `71682`: **5/5 passed, exit 0**, without retries. The
[artifact directory](../../../.artifacts/background-output-stage-84797-ceeef8f)
contains all five JSON reports and the four held-Background PNGs;
`.last-run.json` reports `passed` with no failed tests. The
[runner log](../../../.artifacts/background-output-stage-84797-ceeef8f.log)
records each of the five successful cases.

Build provenance is separate from the browser exit: the demo build log reached
the complete Vite/Svelte output and `✔ done`, but its PowerShell invocation
returned 1 after reporting the native warning stream. This result verifies the
built bytes served by that run; it does not reclassify the build invocation as
exit 0.

| Observed boundary | Recorded result |
| --- | --- |
| Output ownership | All **23 explicit snapshots** and **18 phase observations** retain `mode: explicit`, the same output texture ID within each case and `implicitBackgroundTarget: false`. The texture appears exactly once in each snapshot's target inventory. No case succeeds by falling back to Legacy. |
| Borrowed preparation | Each of the five initial sources has a current `leased-canvas:` profile and at least one actual borrow. Both Back completions and both abort recoveries restore current catalog readiness using that owner. |
| First Moving / complete Reveal | All five GPU methods are instrumented in every case. All **five Moving windows** and the **three completed Reveal windows** contain **zero** measured pipeline, shader, buffer or texture creations. Initialization and binding calls outside those windows remain in the JSON; zero is not a whole-navigation allocation claim. |
| List → detail → held Back | Full **1440 × 1000** Background screenshots have spatial RGB range **205** and exact maximum RGBA error **0** across the held paint interval. Publications remain **56 → 56**, borrows **1 → 1**, and the outgoing owner stays held. After release, the catalog becomes ready and usable again. |
| Carousel → detail → held Back | The corresponding full **1440 × 1000** pair has spatial RGB range **217**, exact error **0**, publications **52 → 52** and borrows **1 → 1**. The held owner releases and catalog readiness returns. |
| Low-only Full/Scroll preparation | High is genuinely requested and blocked through scrolling and zoom. Ordinary quality-set `warmups` change **0 → 2**; `inactiveScrollWarmups` remains **0** and Full `activeScale` returns to **1**. The sticky header activates after actual document scrolling; the Low hero remains active before/after zoom, with additional minimap rendering and a usable minimap. |
| Detail resize after zoom/reset | Dimensions change **1440 × 1000 → 1280 × 900**, generation **2 → 4**, with the same output texture ID and a current replacement catalog profile. |
| Slow Escape abort | Before any detail root mounts, cancellation returns `cancelled:interaction`. The same live textarea and its edited value survive, are no longer inert, and borrowed readiness returns; output generation stays **1**. |
| Slow resize abort | Cancellation returns `cancelled:resize`; the same live textarea/value and input usability survive. The owner resizes to **1280 × 900**, generation **1 → 3**, retains its texture ID and regains borrowed readiness. |

All five recorded `pageerror` arrays are empty. This harness does not add a
separate GPU-validation error scope, so that observation must not be reported as
a new dedicated GPU-validation proof. In the three forward Reveal phase
observations the cached catalog profile is temporarily null while binding
invalidates it; subsequent explicit snapshots record the current replacement
profile. The owner itself remains explicit with unchanged texture identity.

The two screenshot pairs prove retained published Background pixels, with real
nonuniform sources and no pixel tolerance. They do not compare every rendered
Stage image against the legacy implementation. During the slow source-abort
cases, the staged phase named `held` is also distinct from the outgoing-Canvas
owner's `held` flag used by the Back-retention checks.

## Remaining limits

This first matrix uses **1440 × 1000 at DPR 1**, with the two stated resizes to
**1280 × 900**. It does not cover all breakpoints, device loss, arbitrary
application-owned materials or renderer callbacks, High-to-Low refinement image
equivalence, fullscreen, or memory/latency acceptance on other hardware. The
read-only absence checks apply to the observed checkpoints; they are not a
measurement of total driver memory. The deferred-Scroll shortcut remains
deliberately unavailable under the candidate flags.

The five functional cases and their instrumented timings are not an unprofiled
pacing cohort or a 20-sample percentile acceptance run. Earlier full navigation,
tarball and Examples results remain bound to their own revisions. Default
activation and physical-device/performance acceptance remain open.
