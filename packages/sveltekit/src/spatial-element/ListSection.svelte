<script lang="ts">
	import { retainListDeviceOrientation } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import Section from './Section.svelte';
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
	}
	let { section, list, cardSize = 'm', textAlign = 'start' }: Props = $props();
	let catalog: HTMLDivElement;
	$effect(() => {
		if (catalog)
			return retainListDeviceOrientation(catalog, () => {});
	});
</script>

<Section {section} presentation="list">
	<div class="catalog" bind:this={catalog} data-device-orientation="" data-card-size={cardSize} data-card-text-align={textAlign}>
		{#each list as spatialElement, index (spatialElement.itemKey ?? spatialElement.id)}
			<SpatialElementCard
				{spatialElement}
				{cardSize}
				{textAlign}
				order={index}
				occurrence={JSON.stringify([section.id, spatialElement.itemKey ?? spatialElement.id])}
			/>
		{/each}
	</div>
</Section>

<style>
	.catalog {
		display: grid;
		grid-template-columns: repeat(var(--spatial-grid-columns), minmax(0, 1fr));
		gap: var(--spatial-grid-gap);
		align-items: start;
		pointer-events: auto;
	}
</style>
