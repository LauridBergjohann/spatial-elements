<script lang="ts">
	import type { ShowcaseProduct } from './products';
	import type { ShowcaseOrders } from './showcaseOrders.svelte';
	let {
		product,
		orders,
		compact = false
	}: {
		product: ShowcaseProduct;
		orders: ShowcaseOrders;
		compact?: boolean;
	} = $props();
	// Illustrative amounts, not manufacturer prices or offers to purchase.
	const unitPrices = { item: 49, wurm: 399, wera: 79, logitech: 129, watches: 12900 };
	const total = $derived(
		new Intl.NumberFormat('en-IE', {
			style: 'currency',
			currency: 'EUR'
		}).format(unitPrices[product.manufacturerId] * orders.get(product.id))
	);
</script>

<div class="demo-order" class:compact>
	<label data-spatial-element-header-field="quantity">
		<span class:visually-hidden={compact}>Quantity</span>
		<input
			title={compact ? 'Quantity' : undefined}
			type="number"
			min="1"
			max="99"
			step="1"
			bind:value={() => orders.get(product.id), (value) => orders.set(product.id, value)}
		/>
	</label>
	<div class="demo-price" data-spatial-element-header-field="price">
		<span class:visually-hidden={compact}>Example total</span><output
			title={compact ? 'Example total' : undefined}
			aria-live="polite">{total}</output
		>
	</div>
</div>
{#if !compact}<p class="demo-notice">Illustrative price only. Not for sale on this website.</p>{/if}

<style>
	.demo-order {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 16px;
	}
	label,
	.demo-price {
		display: grid;
		gap: 4px;
		font-size: 13px;
	}
	input {
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
	input:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: 2px;
	}
	.demo-price {
		text-align: end;
		white-space: nowrap;
	}
	output {
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
	.compact {
		gap: 12px;
		align-items: center;
	}
	.compact label,
	.compact .demo-price {
		gap: 0;
		font-size: 11px;
		line-height: 16px;
	}
	.compact input {
		height: 42px;
		width: 76px;
		padding: 4px 6px;
	}
	.compact output {
		font-size: 18px;
		line-height: 54px;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
