<script lang="ts">
 import { getContext } from 'svelte';
 import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
 import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
 import { spatialLayoutTokens, type SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';
 import { useSpatialTheme } from './brandContext.js';
 import SpatialCardSlot from './SpatialCardSlot.svelte';
 let { spatialElement, occurrence, order = 0, cardSize = 'm', textAlign = 'start' }: {
  spatialElement: SpatialListItem; occurrence: string; order?: number; cardSize?: SpatialCardSize; textAlign?: 'start' | 'center';
 } = $props();
 const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
 const readTheme = useSpatialTheme();
 const brand = $derived(readTheme());
 const span = $derived(cardSize === 'l' ? `var(--spatial-card-large-span, ${spatialLayoutTokens.cards.l.span})` : spatialLayoutTokens.cards[cardSize].span);
 // Asset/catalog membership follows the route; a retained visual island never adds an old page again.
 $effect(() => items?.register({ ...spatialElement, occurrence }));
</script>
<div class="spatial-card-placement" style:--card-grid-span={span}>
 <SpatialCardSlot instanceKey={`card:${brand.id}:${occurrence}`} context={{ spatialElement, occurrence, order, cardSize, textAlign }} />
</div>
<style>
 .spatial-card-placement { grid-column: span var(--card-grid-span); aspect-ratio: 1; min-width: 0; min-height: 0; transform-style: preserve-3d; }
</style>
