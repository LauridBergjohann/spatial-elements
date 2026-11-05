# Layout and navigation checkpoint — 2026-11-05

The layout implementation remains usable with the existing navigation path.
Early staged navigation still requires `stagedNavigation=1`. The shared
Background output additionally requires `stage-test=1&stage-background-output=1`;
it has not been enabled for ordinary applications. Nothing was published.

## Changes in this continuation

- `ceeef8f` connects the independently verified Background output owner and
  borrowed Catalog preparation to the Stage behind both test flags. The same
  owned target is used from initialization through rendering, retained Back,
  preparation, resize and disposal. The older deferred-Scroll shortcut remains
  conservatively disabled in this experiment.
- `1e24787` updates two existing source-motion test fixtures for that pipeline
  dependency. `6b52039` completes the Svelte diagnostic defaults before a live
  Stage exists. Neither change relaxes an assertion.
- `5836f4b` labels the experimental and default performance cohorts separately,
  preserving the original timing/resource gates and rejecting mixed labels.
- The Examples development-only Scroll-History fixture was migrated separately
  to synchronous source capture and asynchronous destination work. It does not
  reinstate the removed outgoing navigation wait in the product.

## Framework verification

| Check | Revision-bound result |
| --- | --- |
| Full unit suite | **1084/1084 in 128 files**, run `56198`, exit 0; Core runtime `ceeef8f` and fixture correction `1e24787`. The preceding run's eight missing-mock failures remain in its log. |
| Type checks | Core and Demo passed in workspace run `45014`. The adapter reported one incomplete diagnostic-default type; after `6b52039`, its own run `22957` passed with **0 errors / 0 warnings**. This is a corrected split result, not a retroactive pass for the original workspace command. |
| Complete ordinary-output staged navigation | **24/24**, run `31172`, exit 0, Demo `84797` / Core `ceeef8f`: List/Carousel, Hero/Dock/3XL, 430/1440/2456 widths, live summaries, errors, cancellations, Back and actual scene-endpoint reuse. |
| Experimental output in the actual Stage | **5/5**, run `71682`, exit 0, same Demo/Core with proof `1235e47`. Stable shared storage, retained Back pixels, Low-only Scroll/Zoom/Resize and two source-abort paths pass. [Exact evidence and limits](background-output-stage-proof.md). |
| Public package consumer | Run `15579`, exit 0, packages built after `6b52039`: **468 Core / 118 Svelte allowlisted files**, independent installation in `spatial-elements-consumer-nsKihX`, automatic Three peer installation, Core import without DOM/GPU, Svelte check and SSR production build. |
| Release metadata / boundaries / generated layout / Wiki | Run `27805`, exit 0: existing beta.7/latest metadata, six release tests, package boundaries, CSS/token agreement and **13 Markdown pages / 31 images** validated and exported locally. No release or Wiki publication. |

The actual Demo build `84797` produced complete Vite/Svelte output and was
served by both browser matrices. Its shell invocation returned 1 after native
warnings; that invocation is not relabelled as exit 0. Package build `89808`
passed. The later independent consumer's typecheck and build passed normally.
The diagnostic-default correction `6b52039` is included in the packed consumer;
the two Demo browser matrices used the preceding built adapter bytes.

Artifacts remain in `.artifacts/background-stage-all-units-final.log`,
`.artifacts/background-stage-workspace-check.log`,
`.artifacts/background-stage-svelte-diagnostics-check.log`,
`.artifacts/staged-production-84797-ceeef8f`,
`.artifacts/background-output-stage-84797-ceeef8f`,
`.artifacts/background-stage-package-consumer.log` and `.artifacts/wiki-export`.
The isolated earlier owner/Catalog pixel proofs are documented separately;
they are not substituted for a full-image comparison of every Stage route.

## Brand Examples verification

The current local tarballs (Core `ceeef8f`, SvelteKit `6b52039`) were installed
without changing the dependency manifests or lockfile, run `86674`, exit 0.
Production build `71912` on Examples `7db5c77` passed. Its targeted production
regression passes **8/8 together**, run `32997`, exit 0: Wera/Wurm/Watches header
continuity, Carousel controls/focus/shared floor and immediate Back under normal
and reduced motion. The six header records contain 309 sampled frames including
184 transition frames and no hidden-header samples. This is a functional result,
not a pacing measurement, full 60-case visual run or experimental-output proof.

Examples `a64601b` then updates only the development Scroll-History fixture to
the synchronous-capture contract. Its complete host typecheck passes with
**0 errors / 0 warnings**, run `54890`, exit 0. The first dev-browser run `52253`
passes 9/17; eight cases time out during initialization before their functional
assertions. Their traces contain slow unbundled module loading and no recorded
page/console errors or HTTP 4xx/5xx responses. A separate rerun gives only the
fixture's startup readiness more time; it does not relax restoration assertions.
That separate complete run `81404` passes **17/17, exit 0**, including destination
preparation, rejection, timeout, cancellation, focus and history. The harness
allows 90 seconds for a complete dev test with multiple initializations; normal
functional expectations retain their 15-second bound. This dev result does not
alter the production eight-case result. The startup correction is committed in
Examples `210cef3`; its subsequent production build `68873` passes with exit 0
using the same installed framework tarballs.

Private artifacts: `.artifacts/background-stage-build.log`,
`.artifacts/background-stage-build-210cef3.log`,
`.artifacts/background-stage-regression-71912-6b52039`,
`.artifacts/background-stage-fixture-check.log` and
`.artifacts/scroll-fixture-a64601b` and
`.artifacts/scroll-fixture-a64601b-ready30`. The private migration document records the
individual cases and the distinct production/development build boundaries.

## Performance decision

The [two new diagnostic cohorts](staged-performance.md#background-output-diagnostic-build-84797--ceeef8f)
are unprofiled, synthetic, n=1 per List/Carousel × cold/warm case, at
1440 × 1000, DPR 1. All starts are under 100 ms, all measured GPU-creation
windows are empty and no sample validation fails. The experimental cohort
passes all four Moving gates but fails two Reveal gates with internal
33.5–33.7 ms gaps. The default control passes all four Reveal gates but has
one 49.9 ms Moving gap. Cold-List calibration is unstable in both cohorts.

These are separate diagnostic observations, not a percentile acceptance or a
demonstrated speedup/regression caused by the owner. No threshold, sample or
pixel comparison was relaxed. Both experimental switches remain opt-in.

The next measured optimization boundary is the synchronous first frame: the
default cold-Carousel sample contains 25.7 ms between adapter entry and motion
and 21.0 ms between first motion and submission. The existing record cannot
attribute all of those costs to individual render passes. Network response
times alone do not establish JavaScript evaluation as their cause. See the
[first-frame audit](staged-performance.md#first-frame-boundary-in-the-default-cold-carousel-sample).

## Remaining work

Steps 14f and 16 of the [implementation plan](../../layout-system-implementation-plan.md)
remain open for calibrated repeated pacing measurements and physical
Android/iOS/Surface validation. Enabling the new path generally is still gated
on those results. A separate [zoom preparation lifetime audit](deferred-zoom-preparation.md)
also identifies an asynchronous resource-lifetime boundary; it was not folded
into this already verified output experiment or represented as fixed.
