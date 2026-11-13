<img src="../../../../website/static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" />

# Native-flow persistent summary proof

This is an isolated integration gate for layout-plan step 08, not a production API. It complements the simpler step-06 persistent-layout proof. Run `npx playwright test --config playwright.persistent-island.config.ts --output .artifacts/persistent-island-proof`; the dedicated development server uses port 4190.

## Ownership and rendering

The persistent layout defines a real Svelte snippet and captures its persistent context. A route-owned `NativeIslandSlot` renders one outer raw-snippet node. On the server, public `svelte/server.render` renders `IslandRoot` and the snippet **inside that native route slot**. The rendered summary contributes its actual intrinsic height, including CSS and container queries, before JavaScript. No equivalent hidden component, cloned panel or fixed-height fallback is rendered.

After application hydration, a controller owned by the persistent layout calls public `hydrate` once, with `recover: false`, against the existing inner root. The test retains a reference captured by a document-start observer and checks that the server article was not replaced. Entering the layout through client routing instead uses public `mount` once because that request has no server island. No Svelte/SvelteKit private runtime or hydration helper is imported.

Before route destruction, a presentation lease transfers to the persistent controller. It moves the **entire hydration/event/query root** to a persistent projection container and fixes its measured source width. The source slot retains the measured source height during movement. A destination route claims the same root, inserts it into its native slot and restores percentage width. Stale source cleanup cannot unmount the newer lease. Finally, leaving the persistent layout unmounts the component exactly once.

The inner root is deliberately separate from the outer raw-snippet node: Svelte may destroy the route's outer node, but does not own the independently hydrated component through that route's effect tree. Moving only some descendants would also lose the delegated-event boundary; the entire inner root must remain together.

## What this proves

- Direct source/detail/wide entry has one real semantic summary in HTML, actual natural route-flow height, scoped component CSS, unique input identifiers, inherited persistent context, and one/two/three query columns with and without JavaScript.
- One real input/counter component, its state, effects and event handlers survive source → detail → wide route destruction and slot adoption.
- A parent-owned snippet remains reactive to its persistent parent's state after adoption. The native destination flow expands when that content grows.
- Merged `page.data` is visible to the persistent layout during SSR. More importantly, this rendering approach does not require moving every product load into a parent layout: the native SSR slot already holds the loaded descriptor and can pass it to its persistent renderer.

## Explicit production boundaries

- The proof accepts **synchronous content-only snippets**. Data needed for initial rendering must be awaited by the route load. A nested render with page-head output throws instead of silently losing its title/meta/CSP output. Arbitrary async SSR, `svelte:head`, hydratable scripts and their CSP/head ownership need a separate explicit contract before support can be claimed. Scoped CSS imported by the persistent component is tested; production bundling still belongs to the integration gate.
- Snippets are defined by a persistent parent and use persistent context. Route-local state/context is not made persistent by moving DOM or by passing the snippet function alone. Page-specific values must be supplied through a stable host-owned presentation model when adopting a new slot.
- Width freezing and source-flow preservation do **not** suspend arbitrary Svelte reactivity, browser font substitution or a component's private asynchronous work. A production host can defer its own destination-model update until the content phase and constrain the moving box; it cannot promise to freeze every possible third-party component effect through public Svelte APIs.
- The fixture has one element. Production must use occurrence keys and explicit source-to-target transfer handles, rather than selecting any matching product ID when multiple carousels or panels are present.
- The fixture exercises successful staged navigation. Its controller is intentionally not a complete production router: route cancellation, errors, resize cancellation, superseded destinations and resource eviction must be integrated with the existing transition coordinator and tested there.
- Existing Stage panel projection must keep the inner hydration root and its descendants together. Reparenting only content out of the inner event root would break delegated handlers. A route-owned Panel can surround the raw slot, provided the root is transferred before route cleanup. This GPU binding/PanelPresentationController integration is not proven by this DOM-only fixture.

## Proposed production seam

`BrandStageShell` may accept `summary: Snippet<[SummaryContext]>`, with a persistent internal host rendered **inside Stage** so it inherits Stage/catalog/theme contexts. The host supplies a default summary renderer for existing element data. `SpatialElementPage` and later each Carousel occurrence render a native `SummarySlot` with its local descriptor and layout constraint; they do not own the interactive summary instance. The host owns a keyed live instance record and a mutable presentation model, while a route slot holds a revocable placement lease.

The transition coordinator must request a specific retained instance before source cleanup, freeze its source query width, and pass that transfer handle to the exact destination slot. Adopting a destination applies destination context/width only in the content phase. This seam preserves default data-loading APIs and requires custom renderer declarations to move to the persistent brand layout. A generic route-local `summary` snippet cannot honestly carry the same persistence guarantee.

Public API references: [imperative mount/hydrate/unmount](https://svelte.dev/docs/svelte/imperative-component-api), [raw snippets](https://svelte.dev/docs/svelte/svelte#createRawSnippet), [server render](https://svelte.dev/docs/svelte/svelte-server), [navigation lifecycle](https://svelte.dev/docs/kit/$app-navigation#onNavigate).
