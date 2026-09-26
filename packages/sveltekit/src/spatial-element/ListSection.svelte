<script lang="ts">
	import Section from './Section.svelte';
	import SpatialElementCard from './SpatialElementCard.svelte';
	import type { SpatialListItem, SpatialElementSectionDefinition } from '@spatial-elements/core/spatial-element/types';
	let { section, list }: { section: SpatialElementSectionDefinition; list: SpatialListItem[] } =
		$props();
</script>

<Section {section} presentation="list">
	<div class="catalog">
		{#each list as spatialElement, index (spatialElement.itemKey ?? spatialElement.id)}
			<SpatialElementCard
				{spatialElement}
				order={index}
				occurrence={JSON.stringify([section.id, spatialElement.itemKey ?? spatialElement.id])}
			/>
		{/each}
	</div>
</Section>

<style>
	.catalog {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(250px, 100%), 1fr));
		gap: 24px;
		align-items: start;
		pointer-events: auto;
		margin-top: 20px;
	}
</style>
