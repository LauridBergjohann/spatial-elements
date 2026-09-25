<script lang="ts">
	import Panel from '../stage/Panel.svelte';
	import { useProductBrand } from './brandContext.js';
	import type { ProductDetailData } from '@spatial-elements/core/product-detail/types';

	let { product }: { product: ProductDetailData } = $props();
	const theme = useProductBrand();
	const minimap = $derived({
		...product.minimap,
		...theme.minimapTheme,
		viewportColor: theme.minimapTheme.viewportColor ?? theme.colors.accent
	});
</script>

<aside class="product-rail" aria-label="Product images">
	{#each product.media as media (media.id)}
		<div
			class="product-media-anchor"
			data-product-dock-minimap-anchor={media.kind === 'minimap' ? '' : undefined}
		>
			<Panel
				catalogEndpoint={media.kind === 'minimap'
					? { brandId: theme.id, productId: product.id, slot: 'pdp.dock', role: 'geometry' }
					: undefined}
				transitionGroup="enter"
				class={`thumbnail-panel ${media.kind === 'minimap' ? 'active' : ''}`}
				shape={{ ...theme.panelShape, contentInset: 0 }}
				theme={theme.panelTheme}
				contentClass="thumbnail-panel-content"
				minimap={media.kind === 'minimap' ? minimap : false}
				data-product-departing-media-content={media.kind === 'minimap' ? undefined : ''}
			>
				{#if media.kind === 'minimap'}
					<button type="button" aria-label={media.label} class="thumb thumb-minimap active"
					></button>
				{:else if media.kind === 'drawing'}
					<button type="button" aria-label={media.label} class="thumb thumb-drawing">
						<span class="drawing-sheet" aria-hidden="true"></span>
					</button>
				{:else}
					<button type="button" aria-label={media.label} class="thumb thumb-image">
						<img src={media.src} alt={media.alt} />
					</button>
				{/if}
			</Panel>
		</div>
	{/each}
</aside>

<style>
	.product-rail {
		position: absolute;
		top: 0;
		left: 0;
		display: grid;
		gap: 14px;
		justify-items: start;
		pointer-events: auto;
	}

	.product-media-anchor {
		width: 120px;
		height: 120px;
	}

	:global(.thumbnail-panel) {
		width: 100%;
		height: 100%;
	}

	:global(.thumbnail-panel-content) {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}

	.thumb {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: var(--product-panel-radius);
		background: transparent;
		cursor: pointer;
	}

	.thumb.active:not(.thumb-minimap) {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--product-accent) 82%, transparent);
	}

	.thumb-minimap {
		position: relative;
		overflow: hidden;
	}

	.thumb-image img {
		display: block;
		max-width: calc(100% - 18px);
		max-height: calc(100% - 18px);
		object-fit: contain;
	}

	.drawing-sheet {
		position: relative;
		width: 74px;
		height: 74px;
		border: 1px solid rgb(74 137 205 / 0.34);
		background:
			linear-gradient(135deg, transparent 46%, rgb(46 117 191 / 0.26) 46% 54%, transparent 54%),
			repeating-linear-gradient(0deg, transparent 0 12px, rgb(74 137 205 / 0.16) 12px 13px),
			repeating-linear-gradient(90deg, transparent 0 12px, rgb(74 137 205 / 0.16) 12px 13px),
			rgb(255 255 255 / 0.82);
	}

	.drawing-sheet::before {
		position: absolute;
		inset: 15px 17px 20px 15px;
		border: 1px solid rgb(74 137 205 / 0.8);
		border-radius: 2px;
		content: '';
	}

	.drawing-sheet::after {
		position: absolute;
		right: 6px;
		bottom: 7px;
		color: rgb(74 137 205 / 0.8);
		font:
			600 7px/1 system-ui,
			sans-serif;
		content: '100 mm';
	}

	@media (max-width: 1100px) {
		.product-rail {
			position: relative;
			left: 0;
			grid-auto-flow: column;
			justify-content: start;
		}
	}
</style>
