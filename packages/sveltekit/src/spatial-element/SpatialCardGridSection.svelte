<script lang="ts">
	import { retainListDeviceOrientation } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import Section from './Section.svelte';
	import { ContentGrid, ContentBlock } from '@page-sections/svelte';
	import type { SpatialCardGridOptions } from './spatialCardGrid.js';
	import SpatialElementCard from './SpatialElementCard.svelte';
	import type {
		SpatialListItem,
		SpatialElementSectionDefinition
	} from '@spatial-elements/core/spatial-element/types';
	interface Props extends SpatialCardGridOptions {
		/** Unique page-local anchor, heading and optional CSS appearance overrides. */
		section: SpatialElementSectionDefinition;
		/** Project element documents with getSpatialListItems; assets register automatically. */
		list: SpatialListItem[];
	}
	let {
		section,
		list,
		cardSize = 'm',
		cardShadow = false,
		itemSpan,
		textAlign = 'start',
		mediaAspect = '1/1',
		mediaFit = 'contain',
		cardTone = 'standard'
	}: Props = $props();
	const reserveEyebrow = $derived(
		cardSize !== 's' && list.some((item) => Boolean(item.eyebrow?.trim()))
	);
	let catalog: HTMLDivElement;
	$effect(() => {
		if (catalog)
			return retainListDeviceOrientation(catalog.querySelector<HTMLElement>('.catalog')!, () => {});
	});
</script>

<Section {section} presentation="list">
	<div bind:this={catalog} style="display: contents">
		<ContentGrid
			class="catalog"
			data-device-orientation=""
			data-card-size={cardSize}
			data-card-text-align={textAlign}
		>
			{#each list as spatialElement, index (spatialElement.itemKey ?? spatialElement.id)}
				{#snippet card()}<SpatialElementCard
						{spatialElement}
						{cardSize}
						{cardShadow}
						{textAlign}
						{mediaAspect}
						{mediaFit}
						{reserveEyebrow}
						{cardTone}
						order={index}
						occurrence={JSON.stringify([section.id, spatialElement.itemKey ?? spatialElement.id])}
					/>{/snippet}
				{#if itemSpan !== undefined}<ContentBlock span={itemSpan}>{@render card()}</ContentBlock>
				{:else}{@render card()}{/if}
			{/each}
		</ContentGrid>
	</div>
</Section>

<style>
	:global(.catalog > .ps-content-block) {
		align-self: stretch;
		display: grid;
	}
	:global(.catalog) {
		align-items: stretch;
		grid-auto-rows: 1fr;
		pointer-events: auto;
	}
</style>
