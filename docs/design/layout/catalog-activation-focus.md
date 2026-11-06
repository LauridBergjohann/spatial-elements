# Activation-owned carousel focus scheduling

An ordinary catalog link still receives native DOM focus synchronously, including
programmatic activation. The action and Carousel component use the same narrow
focus scope. This scope identifies only the focus events dispatched by their own
`focus({ preventScroll: true })` call; it does not infer whether a router accepted
the link and never checks `isTrusted`.

For the selected Carousel actor, a newly visible focus outline normally requests
a complete source render. The layer now records that focus state immediately but
coalesces this one GPU invalidation through a single RAF. That callback requests
the normal Stage frame. It gives SvelteKit's link RAF/timer an opportunity to reach
the existing `beforeNavigate` handler without first drawing an intermediate
source outline. A started transition consumes/cancels this pending focus request.
No global Stage frame is paused or cancelled by the focus helper.

If navigation is absent or prevented, the callback requests the ordinary render
unconditionally. **This particular programmatically activated GPU focus effect
can appear one paint opportunity later than before**, including a late DOM click
veto. A `beforeNavigate` cancellation can use the already queued next Stage frame.
There is no timer waiting indefinitely for router acceptance. The behaviour also
applies without the staged-navigation opt-in.

Tab, autofocus, unrelated focus, neighbour selection, pointer hover/press/release,
modifier clicks, downloads, authored targets and explicit focus/scroll/history/
reload link policies retain their ordinary scheduling. An already active pointer
outline remains a semantic no-op. The saved focus state still makes later focus
loss visible. Transition takeover, replacement catalog data and disposal cancel
the deferred request; an ownership token rejects stale callbacks.

Unit tests cover scope restoration (including nested/throwing focus calls), link
exclusions, trusted and programmatic parity, immediate input paths, bounded
fallback, transition takeover and disposal. The separate
`playwright.catalog-activation-focus.config.ts` production proof covers navigation
with and without staged mode, late DOM veto, Tab, warm pointer press and neighbour
selection. These are functional scheduling checks; latency improvement requires
an unchanged-protocol performance trace after a coherent production build.

Build `70245`, runtime `8eaf276`, passed all six separate browser cases. Evidence
is retained under `.artifacts/catalog-activation-focus-70245-8eaf276`. This is a
functional pass, not a speed claim. The subsequent sampled cold trace showed
a 39-submit source frame before the adapter. Its registration is distinct from
the short activation-focus RAF and occurs in a post-click microtask. The later
isolated readiness-notification fix (`be72259`, build `36109`) removes that extra
request in the matching diagnostic trace: the deferred focus Stage RAF is then
cancelled by transition takeover, with zero GPU submissions before adapter entry.
See [the preserved before/after evidence](catalog-preparation-notifications.md).
This confirms the scheduling sequence in those runs; it is not repeated
unprofiled performance acceptance.
