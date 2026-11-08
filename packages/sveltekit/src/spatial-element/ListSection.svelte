<script lang="ts">
	import { retainListDeviceOrientation } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import Section from './Section.svelte';
	import { ContentGrid } from '@page-sections/svelte';
	import type { CardMediaAspect, CardMediaFit, SurfaceTone } from '@page-sections/core';
	import SpatialElementCard from './SpatialElementCard.svelte';
	import type { SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import type {
		SpatialListItem,
		SpatialElementSectionDefinition
	} from '@spatial-elements/core/spatial-element/types';
	interface Props {
		/** Unique page-local anchor, heading and optional CSS appearance overrides. */
		section: SpatialElementSectionDefinition;
		/** Project element documents with getSpatialListItems; assets register automatically. */
		list: SpatialListItem[];
		/** Uniform card size for this list; spans follow the current content grid. */
		cardSize?: SpatialCardSize;
		/** Align both title and optional eyebrow inside the card. */
		textAlign?: 'start' | 'center';
		mediaAspect?: CardMediaAspect;
		mediaFit?: CardMediaFit;
		cardTone?: SurfaceTone;
	}
	let { section, list, cardSize = 'm', textAlign = 'start', mediaAspect = '1/1', mediaFit = 'contain', cardTone = 'standard' }: Props = $props();
	const reserveEyebrow = $derived(list.some(item => Boolean(item.eyebrow?.trim())));
	let catalog: HTMLDivElement;
	$effect(() => {
		if (catalog)
			return retainListDeviceOrientation(catalog, () => {});
	});
</script>

<Section {section} presentation="list">
	<div bind:this={catalog} style="display: contents"><ContentGrid class="catalog" data-device-orientation="" data-card-size={cardSize} data-card-text-align={textAlign}>
		{#each list as spatialElement, index (spatialElement.itemKey ?? spatialElement.id)}
			<SpatialElementCard
				{spatialElement}
				{cardSize}
				{textAlign} {mediaAspect} {mediaFit} {reserveEyebrow} {cardTone}
				order={index}
				occurrence={JSON.stringify([section.id, spatialElement.itemKey ?? spatialElement.id])}
			/>
		{/each}
	</ContentGrid></div>
</Section>

<style>
 :global(.catalog) { align-items: stretch; grid-auto-rows: 1fr; pointer-events: auto; }
</style>
