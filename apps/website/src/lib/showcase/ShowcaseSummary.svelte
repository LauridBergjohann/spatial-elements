<script lang="ts">
	import {
		SpatialElementSummaryContent,
		type SpatialSummaryContext
	} from '@spatial-elements/sveltekit';
	import SquareArrowRightExit from 'lucide-svelte/icons/square-arrow-right-exit';
	import { showcaseProducts } from './products';
	let context: SpatialSummaryContext = $props();
	const product = $derived(
		showcaseProducts.find((product) => product.id === context.spatialElement.id)
	);
	const brand = $derived(product?.segment.id === 'industrial' ? product.manufacturerId : undefined);
</script>

{#if brand}
	<SpatialElementSummaryContent {...context}>
		{#snippet leading()}
			<div class="manufacturer-logo" data-catalog-secondary>
				<img
					src={`/assets/brands/${brand}-logo.${brand === 'item' ? 'svg' : 'webp'}`}
					alt={product?.manufacturer.name}
				/>
			</div>
		{/snippet}
		{#snippet actionIcon()}<SquareArrowRightExit
				size={27}
				strokeWidth={1.8}
				aria-hidden="true"
			/>{/snippet}
	</SpatialElementSummaryContent>
{:else}
	<SpatialElementSummaryContent {...context} />
{/if}

<style>
	.manufacturer-logo {
		align-self: flex-start;
		padding: 8px 12px;
		border-radius: var(--spatial-element-control-radius);
		background: #fff;
	}
	.manufacturer-logo img {
		display: block;
		width: auto;
		max-width: 150px;
		height: 32px;
		object-fit: contain;
	}
</style>
