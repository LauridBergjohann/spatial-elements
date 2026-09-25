<script lang="ts">
	import Section from './Section.svelte';
	import ProductCard from './ProductCard.svelte';
	import type { ProductOverviewItem, ProductSectionDefinition } from '@spatial-elements/core/product-detail/types';
	let { section, list }: { section: ProductSectionDefinition; list: ProductOverviewItem[] } =
		$props();
</script>

<Section {section} presentation="list">
	<div class="catalog">
		{#each list as product, index (product.itemKey ?? product.id)}
			<ProductCard
				{product}
				order={index}
				occurrence={JSON.stringify([section.id, product.itemKey ?? product.id])}
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
