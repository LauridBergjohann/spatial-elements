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
	let quantity = $state<number | undefined>(1);
	// Deliberately illustrative, not manufacturer prices or an offer to purchase.
	const demoUnitPrice = $derived(brand === 'item' ? 49 : 399);
	const demoTotal = $derived(
		new Intl.NumberFormat('en-IE', {
			style: 'currency',
			currency: 'EUR'
		}).format(demoUnitPrice * (quantity ?? 1))
	);
</script>

{#if brand}
	<SpatialElementSummaryContent {...context}>
		{#snippet leading()}
			<div class="manufacturer-logo">
				<img
					src={`/assets/brands/${brand}-logo.${brand === 'item' ? 'svg' : 'webp'}`}
					alt={product?.manufacturer.name}
				/>
			</div>
		{/snippet}
		{#snippet beforeAction()}
			<div class="demo-order">
				<label
					>Quantity <input type="number" min="1" max="99" step="1" bind:value={quantity} /></label
				>
				<div class="demo-price">
					<span>Example total</span><output aria-live="polite">{demoTotal}</output>
				</div>
			</div>
			<p class="demo-notice">Illustrative price only. Not for sale on this website.</p>
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
	.demo-order {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
	}
	.demo-order label,
	.demo-price {
		display: grid;
		gap: 4px;
		font-size: 13px;
	}
	.demo-order input {
		box-sizing: border-box;
		width: 76px;
		height: 42px;
		padding: 8px;
		border: 1px solid var(--spatial-element-body);
		border-radius: var(--spatial-element-control-radius);
		background: transparent;
		color: var(--spatial-element-ink);
		font: inherit;
		font-size: 16px;
	}
	.demo-order input:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: 2px;
	}
	.demo-price {
		text-align: end;
	}
	.demo-price output {
		font-size: 22px;
		font-weight: 650;
		line-height: 42px;
	}
	.demo-notice {
		margin: 8px 0 0;
		font-size: 12px;
		line-height: 1.4;
		color: var(--spatial-element-body);
	}
</style>
