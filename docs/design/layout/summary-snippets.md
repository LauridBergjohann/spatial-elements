# Summary rendering and the step-08 integration seam

`BrandStageShell` accepts an optional `summary` snippet. Define it in the persistent brand layout, where its business state and contexts live. Existing consumers keep the default title, eyebrow, feature list and optional action without changing their page load functions.

```svelte
<script lang="ts">
  import { BrandStageShell } from '@spatial-elements/sveltekit';
  import ProductConfiguration from '$lib/ProductConfiguration.svelte';
  let { data, children } = $props();
</script>

<BrandStageShell theme={data.theme}>
  {#snippet summary(context)}
    <ProductConfiguration {context} />
  {/snippet}
  {@render children()}
</BrandStageShell>
```

`SpatialSummaryContext` contains the resolved common element fields (`spatialElement`), `mode`, `heading`, `contentInset` and the framework's catalog endpoint address factory. The snippet can close over additional persistent host state such as cart contents. Route-specific model values that need to survive a transition must be supplied through the presentation model, rather than captured from a route that will unmount. Custom content should provide the detail heading with `id="spatial-element-title"` when `context.heading` is `h1`, preserving the hero's accessible name and its overview focus target.

Every instance has an inline-size query container named `spatial-summary`. Host components can use `@container spatial-summary (...)` to choose columns from their actual available content width. The framework does not impose a column count on arbitrary summaries. The demonstration under `/proof/detail-layout/short` and `/long` shows interactive custom content with one, two and three column rules; the wide-panel proof separately exercises all three query widths.

The outer panel has natural height. XS/S summaries stay in document flow without a height cap. M–2XL summaries align to the hero top and scroll locally when their natural content height exceeds the shared fit height. The renderer measures intrinsic source content only to keep an existing GPU panel's native placeholder synchronized; it does not derive known hero anchors from destination DOM or invent a destination height.

## Rendering and lifecycle boundaries

The native route slot renders genuine summary HTML on the server using public `svelte/server.render`. The persistent host subsequently hydrates that inner root once with `recover: false`, or mounts once on a client-only entry. The inner root contains the query container and the delegated event boundary. Stage projection may move that root together with its ancestor panel content; it must not extract children from the root. The production browser fixture verifies real input and counter interaction after GPU enhancement.

The host owns the independent Svelte component and the route holds a revocable placement lease. Step 08 supplies this ownership seam; **ordinary production route navigation still releases its slot normally**. The isolated persistent-island proof validates explicit transfer before route teardown. Connecting occurrence-specific retain/adopt handles to Carousel and the transition coordinator is intentionally scheduled for steps 12/14. Product IDs alone are not sufficient instance keys when the same product appears in multiple sections.

Initial output must be **synchronous and content-only**. Await initial product data in the page load. Snippets with `svelte:head` are rejected explicitly; arbitrary asynchronous SSR, head/CSP/hydratable-script aggregation are not supported by this nested-render contract. Scoped component CSS, persistent parent reactivity, inherited persistent context and SSR input identifiers are covered by the proof.

A future movement phase can freeze the query width and outer content box and defer host-owned destination-model updates. This does not suspend arbitrary Svelte effects, third-party asynchronous work or browser font substitution. Components that change their intrinsic layout during movement need an explicit host policy; there is no promise to pause all application reactivity.

## Checks

- `playwright.persistent-island.config.ts`: real server node identity, independent component lifetime, native flow, context, events, one/two/three query widths, direct SSR/no-JavaScript entry and first client navigation.
- `playwright.detail-layout.config.ts`: production XS–2XL hero/rail/summary anchors against the pure resolver, classic scrollbar geometry, intrinsic short summaries, bounded long summaries, compact reflow and interactive content after GPU enhancement.
- The shared CSS generator consumes `layoutTokens.json`; `layout-detail-css.mjs` contains its detail-specific formulas, including the normalized lower-2XL rail width. `100svh` keeps hero height stable while mobile browser chrome changes. Core consumers use the same Stage-owned cached layout metrics.
