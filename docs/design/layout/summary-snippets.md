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

The host owns the independent Svelte component and the route holds a revocable placement lease. Ordinary navigation releases its slot normally. Carousel occurrences use the same ownership seam; the staged navigation adapter explicitly retains and adopts a selected occurrence while its experimental integration gate is enabled. Product IDs alone are not sufficient instance keys when the same product appears in multiple sections.

Initial output must be **synchronous and content-only**. Await initial product data in the page load. Snippets with `svelte:head` are rejected explicitly; arbitrary asynchronous SSR, head/CSP/hydratable-script aggregation are not supported by this nested-render contract. Scoped component CSS, persistent parent reactivity, inherited persistent context and SSR input identifiers are covered by the proof.

The adapter-owned presentation host can freeze the query width and local border box and defer host-owned destination-model updates. This does not suspend arbitrary Svelte effects, third-party asynchronous work or browser font substitution. Components that change their intrinsic layout during movement need an explicit host policy; there is no promise to pause all application reactivity.

## Checks

- `playwright.persistent-island.config.ts`: real server node identity, independent component lifetime, native flow, context, events, one/two/three query widths, direct SSR/no-JavaScript entry and first client navigation.
- `playwright.detail-layout.config.ts`: production XS–2XL hero/rail/summary anchors against the pure resolver, classic scrollbar geometry, intrinsic short summaries, bounded long summaries, compact reflow and interactive content after GPU enhancement.
- The shared CSS generator consumes `layoutTokens.json`; `layout-detail-css.mjs` contains its detail-specific formulas, including the normalized lower-2XL rail width. `100svh` keeps hero height stable while mobile browser chrome changes. Core consumers use the same Stage-owned cached layout metrics.

## Step-14 presentation transfer

The production host owns complete presentation roots, identified by explicit occurrence keys. A card uses the stable framework Card renderer, including the real link, surface, copy and geometry anchor. Its route-owned grid placement remains square and keeps catalog asset registration; keeping the visual island alive does not register the old catalog route again. The wrapper has no containment or overflow that would flatten the existing CSS 3D hover transforms.

A Carousel root owns the real surface, compact title, full summary, information arrow and optional section link. Its route-owned summary element supplies positioning only. The outer `data-spatial-presentation-root` is the independent hydration/delegated-event boundary; the inner `data-spatial-summary-root` remains the named query container and local overflow owner. Move the whole outer root. GPU glass ownership is separate and must be retained by the scene coordinator; the DOM host preserves the current glass-ready marker and inherited presentation values during a hold.

The internal adapter API is `retainByElement(element)` / `retain(key)`, returning a lease handle:

- `freeze()` preserves the local, untransformed CSS border box without reparenting or releasing endpoint claims. Perspective-projected bounding rectangles are never used as CSS sizes.
- `hold(targetHost)` moves the complete root into a persistent placement, disables its source endpoint claims and interaction, and keeps the source Svelte instance alive while the route unmounts.
- `adopt(slot, key?, context?)` transfers a summary to an already bound summary slot. The incoming temporary instance is disposed, the original instance takes the destination placement lease, and the controlled destination model waits for `unfreeze()`. A stale source release cannot dispose the destination owner.
- `restore()` cancels a hold while the original route slot still exists, returning the same root and assigning a fresh cleanup lease to that slot. It declines after adoption or source destruction; the caller then releases its unadopted hold.
- `unfreeze()` restores native dimensions and applies the pending host model in the content phase. `release()` disposes an unadopted retained source exactly once; after adoption that older release is deliberately stale.

Card-to-detail is a content change between different renderers. Its source Card is retained through motion and target binding, then released after the new detail content is revealed. It is not represented as preserving the Card component as a detail form. Carousel-to-detail uses the same summary renderer and can preserve the original form state and events.

Stage receives this child-owned host through the adapter-local `SPATIAL_PRESENTATION_OWNER` registration context. No core module depends on Svelte component internals. The `playwright.presentation-transfer.config.ts` fixture exercises SSR/native flow, real source identity, local box freezing under a perspective transform, route destruction, adoption, stale cleanup and complete Card retention. Integration with navigation cancellation and the GPU scene is separately owned by the transition coordinator.

The production ownership matrix passes 18 browser cases: eight card-grid/SSR cases, one subpixel Carousel projection case and nine presentation lifecycle cases. It includes the controlled-context update boundary, cancellation cleanup and preservation of a prepared Card poster decision after catalog actor disposal. The isolated regression fixtures exercise actual public Svelte mount/hydrate lifetimes; they do not substitute cloned DOM for a component. The early-navigation GPU timing and source-only frame gates are separate coordinator checks.
