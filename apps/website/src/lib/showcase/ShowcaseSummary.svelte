<script lang="ts">
	import { onMount } from 'svelte';
	import {
		SpatialElementSummaryContent,
		type SpatialSummaryContext
	} from '@spatial-elements/sveltekit';
	import SquareArrowRightExit from '@lucide/svelte/icons/square-arrow-right-exit';
	import { showcaseProducts } from './products';
	import ShowcaseOrder from './ShowcaseOrder.svelte';
	import type { ShowcaseOrders } from './showcaseOrders.svelte';
	let {
		appearance,
		orders,
		...context
	}: SpatialSummaryContext & { appearance: 'light' | 'dark'; orders: ShowcaseOrders } = $props();
	const product = $derived(
		showcaseProducts.find((product) => product.id === context.spatialElement.id)
	);
	const brand = $derived(product?.segment.id === 'industrial' ? product.manufacturerId : undefined);
	// Summary islands hydrate after the layout restores the theme. Match the SSR image
	// first: Svelte deliberately does not repair a differing src during hydration.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});
</script>

{#snippet manufacturerLogo()}
	{#if brand}<div class="manufacturer-logo">
			<img
				src={`/assets/brands/${brand}-logo${mounted && appearance === 'dark' ? '-dark' : ''}.${brand === 'item' ? 'svg' : 'webp'}`}
				alt={product?.manufacturer.name}
			/>
		</div>{/if}
{/snippet}

{#if product}
	<SpatialElementSummaryContent {...context} leading={brand ? manufacturerLogo : undefined}>
		{#snippet beforeAction()}
			<ShowcaseOrder {product} {orders} />
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
	}
	.manufacturer-logo img {
		display: block;
		width: auto;
		max-width: 150px;
		height: 32px;
		object-fit: contain;
	}
</style>
