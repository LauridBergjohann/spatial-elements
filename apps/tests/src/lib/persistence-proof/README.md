<img src="../../../../website/static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" />

# Persistent summary integration gate

This fixture is intentionally outside the demo's existing Stage/BrandStageShell. Open `/proof/persistent-summary/source`, `/target` or `/wide`. Add `?hold=1` to hold the movement until **Finish motion** is pressed. These are engineering fixtures, not a proposed production component API.

The persistent `+layout.svelte` defines the snippet and owns `InteractiveSummary`. Its request-local layout load supplies the initial slot descriptor, so direct requests render the real controls into HTML before hydration. Pages only claim placement. Registering a route-owned snippet after mount cannot provide this SSR guarantee or extend that snippet's lifetime beyond route destruction.

`SummaryPresentation` temporarily reparents the same query-container node into its own persistent projection surface. Svelte still owns the component through the parent layout. The fixture deliberately changes routes while that node is outside its authored parent, then restores it. There is one interactive instance and one set of effects throughout. Source height is measured once for its flow placeholder; destination measurement never gates the movement.

The bridge uses the existing core `PresentationLease` to retain ownership before source cleanup. Destination claims replace the bridge owner, stale releases cannot dispose a newer owner, and superseded route mounts cannot steal a later transition's lease. This is the ownership seam that a future SpatialPageRegistry/PanelPresentationController integration must consume; their production behavior is unchanged here.

The fixture uses only public Svelte/SvelteKit APIs. `onNavigate` can hold a route commit and return a callback for after DOM updates; that callback is the content handoff. Layout-owned state is request-local, and the snippet definition remains in the persistent layout. See [navigation lifecycle](https://svelte.dev/docs/kit/$app-navigation#onNavigate), [layout state lifetime](https://svelte.dev/docs/kit/state-management#Component-and-page-state-is-preserved) and [snippet rendering](https://svelte.dev/docs/svelte/@render).

The movement freezes the query width and currently rendered content. The content phase applies the destination width and queued content/typeface change. The source/target/wide variants produce one, two and three container-query columns. The font test covers an application-controlled delayed typeface change; it does not claim to suppress arbitrary browser-wide webfont substitution. Actual GPU projection, real destination layout, externally changing snippets and resize cancellation remain separate integration work. The DOM fallback retains the same semantic content and initial layout; JavaScript-free full page loads naturally create a new component instance.

Validation:

- `npx vitest run tooling/persistent-summary-proof.spec.ts` checks lease cleanup, width/content freezing, cancellation and stale/superseded owners.
- `tests/persistent-summary.e2e.ts` checks actual DOM identity, interactive state and effects through route destruction, live reparenting, cleanup, three query widths, raw SSR HTML, hydration and no-JavaScript direct entry.
- For a separate development server, set `SPATIAL_E2E_DEV=1` and run `npx playwright test --config playwright.persistent-summary.config.ts`. Its readiness URL targets the isolated fixture, its port defaults to 4187, and its output stays in `.artifacts/persistent-summary-proof` to avoid collisions with other suites. A production-build run remains part of final integration validation.
