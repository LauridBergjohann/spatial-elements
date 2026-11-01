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

## Verification boundary

The focused CPU regression executes the actual Stage capture function and Bridge
navigation callback with mocked existing ports. It checks capture before source
unmount despite unresolved feedback, immediate non-promise hook return for
link/goto/popstate, deferred destination restoration, synchronous errors,
supersession, page reuse, and the already-held staged path. It does not emulate
Kit's renderer and does not replace the real-browser rapid-Back regression.

All seven focused cases pass. Together with the existing capture, early-gate,
feedback and interrupted-presentation suites, 38/38 tests in five files pass;
the SvelteKit source check reports 0 errors and 0 warnings. No package build or
browser run was performed for this source checkpoint.

Production browser evidence, including route/DOM coherence, history state and
normal return animation, must be recorded separately. No performance improvement
or full private regression pass follows from this synchronous-boundary change.
