# Synchronous source capture before route commit

The ordinary catalog path retains its outgoing DOM, projection and GPU ownership
inside the synchronous `onNavigate` callback. It returns no promise to SvelteKit.
The source must be captured before that callback returns; an asynchronous callback
is excluded by the internal `onCapture: (navigation) => undefined` contract.

Previously `Stage.captureNavigation()` waited for `NavigationFeedback.painted`
(two RAFs) before reading the source. `ScrollNavigationBridge` returned that wait
to Kit, bounded by a 500 ms timeout. In installed Kit 2.70.3, the URL/history update
precedes its awaited `onNavigate` callbacks. A rapid Back during this interval can
supersede navigation while the outgoing Carousel still owns the DOM; the obsolete
route commit can then provide detail data to its Carousel snippet. The observed
failure is `list` becoming undefined in `CarouselSection.orderedItems`, not merely
lost focus.

The existing source capture is already synchronous after the feedback wait:
`CatalogTransition.capture()` reads source layout, retains decorative DOM and its
presentation lease, and captures the existing GPU model. Page reuse/signature or
source-page release follow in the same call stack. Removing the wait therefore
does not leave background work reading destroyed source DOM. The obsolete bridge
preparation timeout and release callbacks are removed as well.

Feedback is still requested immediately. On a very warm route, it no longer has a
guaranteed separate paint opportunity before synchronous capture. The normal
transition and subsequent destination/GPU preparation are unchanged. Target
binding, scroll restoration and animation still run after `navigation.complete`,
with generation checks and the original navigation object. A failed source
capture releases visual state and retains that normal destination-restoration path.

This change does not cancel/replay ordinary navigation, call `goto`, replace
history entries, or manufacture popstate state. Kit retains link/goto/popstate
semantics, entry state, scroll targets and Forward history. The existing early
staged forward gate remains separate: its restricted cancel/preload/goto replay
cannot simply replace genuine Back/Forward navigation.

## Fullscreen source ownership

The same synchronous boundary retains the visible fullscreen pose **before**
leaving fullscreen. Fullscreen exit restores document styles and scroll, then
refits the live Stage camera. Performing that exit first would combine a newly
refitted inline camera with the fullscreen pixels that were last displayed.

`captureNavigation()` now captures the source and, unless reusing the existing
page, releases its page-local bindings before leaving fullscreen in `finally`.
Early returns and capture/commit/release errors still exit fullscreen; the error
continues to the existing bridge fallback. No paint wait or router hold is added.

`SpatialGeometryCapture` owns copied model/camera/clip matrices and an independent
camera. The hero transfer retains its model, High/Low resources and blend. A
captured minimap root is physically removed from its old display parent, so
disposing that parent's bindings does not traverse the retained root. Subsequent
Stage camera refits cannot rewrite the captured source projection. Native
fullscreen exit may change the actual viewport later; the existing resize
interruption remains valid and is not suppressed.

## Verification boundary

The focused CPU regression executes the actual Stage capture function and Bridge
navigation callback with mocked existing ports. It checks capture before source
unmount despite unresolved feedback, immediate non-promise hook return for
link/goto/popstate, deferred destination restoration, synchronous errors,
supersession, page reuse, and the already-held staged path. It does not emulate
Kit's renderer and does not replace the real-browser rapid-Back regression.

At the initial synchronous-boundary checkpoint, all seven focused cases passed.
Together with the existing capture, early-gate,
feedback and interrupted-presentation suites, 38/38 tests in five files pass;
the SvelteKit source check reports 0 errors and 0 warnings. No package build or
browser run was performed for this source checkpoint.

Production browser evidence, including route/DOM coherence, history state and
normal return animation, must be recorded separately. No performance improvement
or full private regression pass follows from this synchronous-boundary change.

The fullscreen follow-up extends the actual-function contract suite to twelve
cases, including capture/release/exit order, preserved pre-refit pose, reuse,
already-held commit, destroyed Stage, and capture/commit/release exceptions.
Together with `SpatialGeometryCapture`, `StageFullscreenController`,
`CatalogTransition` and interrupted-presentation units, **28/28 tests in five
files pass**; the SvelteKit source check again reports **0 errors and 0 warnings**.
Playwright discovers both new cases, but the browser fixture has not yet run:

```sh
npx playwright test --config playwright.fullscreen-navigation.config.ts --output .artifacts/fullscreen-navigation-<build>-<revision>
```

It uses the real Carousel → Detail → Back route and a rotated, zoomed hero.
The denied-native-API fallback holds only the destination binding after commit,
then compares the retained source against the prior fullscreen renderer at four
projective basis points with a maximum error of **1 CSS pixel**. A separate
native-fullscreen case checks exit plus resize interruption and a usable
destination, without imposing equal pixel positions across viewport changes.
Both cases verify capture/overlay/inert cleanup and navigate again through the
destination link. No browser result is implied by the CPU checks.
