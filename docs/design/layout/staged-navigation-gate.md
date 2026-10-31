# Public routing gate for staged navigation

The first motion must use the mounted source, while data loads concurrently. The destination route must not construct its DOM until this motion finishes. A cancelled or superseded request must never mount an obsolete destination. This document records the isolated routing proof; the production GPU frame budget is a separate acceptance gate.

## Why the first motion does not use an `onNavigate` promise

The installed SvelteKit 2.70.3 calls `onNavigate` after loading route data. More importantly, its deferred commit is not safe for this use: when navigation A waits for source motion and warm navigation B supersedes it, releasing A's promise still constructs and mounts A before B commits. Correctly cancelling the visual owner alone cannot prevent that stale route mount.

The proof retains this as an explicit control test, not as the supported implementation. In the recorded control, A mounted after the second click and remained present for roughly 0.8 seconds while B's source motion ran. Keep this test when upgrading Kit: a change in the observed limitation warrants reviewing the simpler native gate again.

The supported path uses only public APIs:

1. `beforeNavigate` obtains a synchronous visual handle and cancels the original link navigation before it enters the router's commit queue.
2. The mounted source begins moving immediately. `preloadData(destination)` runs concurrently.
3. One owner waits for both data and motion. A newer navigation invalidates that owner. Public preload requests cannot be aborted, so late results are ignored.
4. The current owner receives exactly one destination-specific replay permit and calls `goto`.
5. The replay's `beforeNavigate` consumes the permit without resetting source ownership. Normal capture, DOM commit, restoration and reveal then continue.

The intentionally rejected original `navigation.complete` is handled without triggering visual cancellation. A native popstate is not converted into a new link or `goto`, preserving history semantics and avoiding phantom entries. Unhandled routes, unknown fragments, and explicitly authored link focus/scroll/history policies stay on the ordinary path.

## Ownership and failure behavior

`EarlyNavigationCoordinator` is framework-independent. Its visual handle has `finished: Promise<boolean>` and `cancel(reason)`. A true result permits commit after data; false means cancellation. Cancellation settles the owner's operation immediately, even if its network request never settles. A rejected motion or preload releases the visual pose and delegates the error page to ordinary navigation. Cleanup errors do not prevent that fallback.

A preload redirect releases the predicted pose before navigating once to the resolved destination. A route's handled error is still owned by Kit: in this version, the proof's universal `error(503, ...)` can produce a preload result with status 200, while the subsequent ordinary `goto` correctly renders the 503 error page. The implementation must not infer successful destination content from preload status alone.

Escape, scroll interaction, resize, a superseding navigation, history navigation and destruction cancel the pending early owner. The production adapter currently accepts same-origin links with a matched route, a different pathname, and either no fragment or the canonical `#overview` fragment. The visual callback can further decline any transition whose source or deterministic target is unavailable. Reduced Motion can resolve the visual handle immediately; the coordinator adds no timer.

The SvelteKit adapter bounds the preload hold to 15 seconds. A deadline restores the source visual state and falls back to ordinary navigation, so a stalled preload cannot leave a frozen transition indefinitely. Each owner also supplies an AbortSignal to release this adapter wait immediately on cancellation; it does not claim to abort Kit's underlying request. The timer and abort listener are removed in `finally`.

## Reproducible proof

The isolated fixture is `/proof/staged-navigation/source`, selected with `strategy=deferred` or the intentionally unsafe `strategy=gate`. Its existing blue source box moves while a route-owned input and source page remain mounted. Constructors, mounts, data readiness, first visible movement, owner changes and router commits are recorded independently. Both targets are warmed through ordinary application data caching, so the supersession test does not depend on one internal Kit preload slot.

Run:

```sh
npx playwright test --config playwright.staged-navigation.config.ts
npx vitest run packages/core/src/catalog/EarlyNavigationCoordinator.spec.ts
```

The browser suite covers warm and cold data, warm/warm supersession, explicit cancellation, handled errors, redirects, Back, Reduced Motion, and native links without JavaScript. Every case writes `events.json`; the visible-motion case also writes before/moving screenshots. The gate-control case deliberately asserts the installed Kit limitation. All ten browser cases passed in the final proof run, with artifacts under `.artifacts/staged-navigation-proof-final`.

One recorded warm run measured the first actual box displacement at 32.9ms after click, data readiness at 7.8ms, source motion ending at 716.1ms, and the target constructor at 723.6ms. This demonstrates the required ordering and immediate source response in an isolated DOM fixture. It is not a production WebGPU p95 result.

## Remaining production performance gate

An asynchronous preload still evaluates imported JavaScript and load functions on the main thread. With the current default `forkPreloads: false`, this proof does not construct a speculative destination Svelte tree, but data parsing and module evaluation can still compete with animation. Production profiling must separately measure those costs, GPU work, source movement frame intervals, and all four list/carousel-to-detail endpoints. The router proof does not justify doing renderer preparation or destination layout work during the first motion.
