<script lang="ts">
	import type {
		CardMediaAspect,
		CardMediaFit,
		CardVariant,
		SurfaceTone
	} from '@page-sections/core';
	import { getContext } from 'svelte';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import { type SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialCardSlot from './SpatialCardSlot.svelte';
	let {
		spatialElement,
		occurrence,
		order = 0,
		cardSize = 'm',
		textAlign = 'start',
		mediaAspect = '1/1',
		mediaFit = 'contain',
		reserveEyebrow = false,
		cardTone = 'standard',
		cardVariant = 'catalog'
	}: {
		spatialElement: SpatialListItem;
		occurrence: string;
		order?: number;
		cardSize?: SpatialCardSize;
		textAlign?: 'start' | 'center';
		mediaAspect?: CardMediaAspect;
		mediaFit?: CardMediaFit;
		reserveEyebrow?: boolean;
		cardTone?: SurfaceTone;
		cardVariant?: CardVariant;
	} = $props();
	const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	// Asset/catalog membership follows the route; a retained visual island never adds an old page again.
	$effect(() => items?.register({ ...spatialElement, occurrence }));
</script>

<div
	class="spatial-card-placement"
	data-ps-card-size={cardVariant === 'catalog' ? cardSize : undefined}
>
	<SpatialCardSlot
		instanceKey={`card:${brand.id}:${occurrence}`}
		context={{
			spatialElement,
			occurrence,
			order,
			cardSize,
			textAlign,
			mediaAspect,
			mediaFit,
			reserveEyebrow,
			cardTone,
			cardVariant
		}}
	/>
</div>

<style>
	.spatial-card-placement {
		grid-column: span var(--ps-card-span, 1);
		min-width: 0;
		min-height: 0;
		transform-style: preserve-3d;
	}
</style>
