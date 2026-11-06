# Tabs measurement lifetime during rapid Back

The two private Wera rapid-Back cases on host build 20223 / framework `039b8e2`
already restored the correct Carousel URL, all eight item records, selected item,
focus and history length. Their strict empty-page-error assertion found a separate
failure: `Cannot read properties of null (reading 'querySelector')`.

Both archived traces in the private host's
`.artifacts/layout-regression-039b8e2-fast-back` identify
`BjE4F7Tg.js:1:36242`. This is the first `anchorElement.querySelector(...)` inside
`SpatialElementTabs.svelte`'s measurement callback. The component's `bind:this`
reference was null; this is separate from the previously diagnosed stale Kit
commit passing detail data into a Carousel snippet. No error assertion is removed.

The existing cleanup already disconnected both observers, removed the resize
listener and cancelled `measureFrame`. However, a font-ready or resize event can
schedule a RAF before the initial `tick().then(measure)` runs. That direct call
previously reset `measureFrame` to zero without cancelling the queued RAF. Cleanup
could then lose the pending callback's ID. The browser traces establish the null
binding; the CPU regression independently reproduces this concrete scheduling
gap. They do not establish which trigger scheduled that particular browser RAF.

Only the RAF wrapper now clears its own scheduling ID. The direct initial
measurement retains ownership of any pending RAF, so cleanup can cancel it and
resize cannot schedule a duplicate. Measurement also checks `disposed` and a
connected local anchor before reading or writing DOM. The initial tick and any
already-delivered callback are safe after binding invalidation. A connected
measurement retains the existing intrinsic-width, Bootstrap and observer behavior.
JavaScript does not interrupt a running callback with teardown; this protects
callback entry after invalidation, without claiming that cancellation can stop a
callback already executing.

`tooling/tabs-measure-lifecycle.spec.ts` executes the production `onMount` body and
its actual callbacks using deterministic scheduling/DOM ports. It covers the
initial tick after a cleared binding, queued callbacks before/after cleanup,
detached/reconnected nodes, observer cleanup, the font-before-tick ownership gap,
and unchanged connected measurement/deduplication. It does not emulate Svelte or
replace the real normal-motion and reduced-motion Wera rapid-Back cases.

Source checkpoint: all seven focused CPU cases pass. The SvelteKit source check
reports zero errors and zero warnings. No package build or browser test was run
for this checkpoint.

## Production browser follow-up

Both private Wera rapid-Back cases now pass on Examples build `82285` against
framework checkpoint `52c342e`, including tab fix `83ea019` and fullscreen-order
fix `6e79c9a` (run `89730`, exit 0). Normal and reduced motion both request Back
at the first product URL commit, retain all eight item records and selected-link
focus, and complete the additional Back/Forward roundtrips with identical opaque
entry state, unchanged history length and no page errors. The assertions and
ordinary focus test were not weakened.

Evidence remains in the private host at
`.artifacts/layout-regression-82285-83ea019-fast-back`. The preceding two failing
`039b8e2` traces remain separate. This targeted two-case result is not a repeated
full private visual suite. The separate fullscreen capture/exit cases also pass
2/2 on demo build `39337` (run `3553`); their projection and resize evidence is
recorded in the [capture contract](synchronous-navigation-capture.md), not inferred
from these private rapid-Back tests.
