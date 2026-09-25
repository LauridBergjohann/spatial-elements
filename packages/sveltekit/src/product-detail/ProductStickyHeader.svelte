<script lang="ts">
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import { ShoppingCart } from 'lucide-svelte';
	import ProductTabList from './ProductTabList.svelte';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	const catalogEndpoint = createCatalogEndpointAction();
	import type { ProductDetailData, ProductSectionNavigationItem } from '@spatial-elements/core/product-detail/types';

	let {
		activeSectionId,
		product,
		sections
	}: {
		activeSectionId?: string;
		product: ProductDetailData;
		sections: ProductSectionNavigationItem[];
	} = $props();

	function handleMinimapActionKeydown(event: KeyboardEvent) {
		if (event.key !== ' ') return;
		event.preventDefault();
		(event.currentTarget as HTMLAnchorElement).click();
	}
</script>

<header
	class="product-sticky-header"
	data-product-sticky-header
	data-catalog-transition-dom="enter"
	aria-label="Current product"
	aria-hidden="true"
	inert
>
	<div
		class="sticky-header-summary-surface"
		data-catalog-dock-surface
		aria-hidden="true"
		use:catalogEndpoint={{
			brandId: product.brandId,
			productId: product.id,
			slot: 'pdp.dock',
			role: 'summary-surface'
		}}
	></div>
	<a
		class="sticky-header-minimap-action"
		data-product-sticky-minimap-action
		data-product-section-navigation
		href="#overview"
		aria-label="Zur Übersicht"
		onkeydown={handleMinimapActionKeydown}
	></a>

	<div class="sticky-header-layout">
		<div class="sticky-header-copy">
			<p
				class="sticky-header-kicker"
				use:catalogEndpoint={{
					brandId: product.brandId,
					productId: product.id,
					slot: 'pdp.dock',
					role: 'eyebrow'
				}}
			>
				{product.eyebrow}
			</p>
			<p
				class="sticky-header-title"
				use:catalogEndpoint={{
					brandId: product.brandId,
					productId: product.id,
					slot: 'pdp.dock',
					role: 'title'
				}}
			>
				{product.title}
			</p>
		</div>

		{#if product.action.href}
			<a
				class="sticky-header-action"
				use:catalogEndpoint={{
					brandId: product.brandId,
					productId: product.id,
					slot: 'pdp.dock',
					role: 'primary-action'
				}}
				data-catalog-rich-shared="primary-action"
				data-catalog-semantic={catalogActionSemantic(product.action)}
				href={product.action.href}
				rel="external"
				aria-label={product.action.ariaLabel}
			>
				<ShoppingCart size={29} strokeWidth={2} aria-hidden="true" />
			</a>
		{:else}
			<button
				use:catalogEndpoint={{
					brandId: product.brandId,
					productId: product.id,
					slot: 'pdp.dock',
					role: 'primary-action'
				}}
				data-catalog-rich-shared="primary-action"
				data-catalog-semantic={catalogActionSemantic(product.action)}
				class="sticky-header-action"
				type="button"
				aria-label={product.action.ariaLabel}
			>
				<ShoppingCart size={29} strokeWidth={2} aria-hidden="true" />
			</button>
		{/if}
	</div>

	<div
		class="product-sticky-tabs"
		data-product-sticky-tabs
		data-catalog-transition-dom="enter"
		aria-hidden="true"
		inert
	>
		<ProductTabList {activeSectionId} {sections} variant="docked" />
	</div>
</header>

<style>
	.sticky-header-summary-surface {
		position: absolute;
		inset: 0 88px 0 0;
		border-radius: inherit;
		pointer-events: none;
	}
	@media (max-width: 1100px) {
		.sticky-header-summary-surface {
			right: 66px;
		}
	}
	.product-sticky-header {
		position: fixed;
		/* ProductDockController portals this element outside the translated document. */
		top: 8px;
		left: 16px;
		z-index: 20;
		box-sizing: border-box;
		width: calc(100vw - 32px);
		height: 86px;
		border: 0;
		border-radius: var(--product-panel-radius);
		visibility: hidden;
		background: transparent;
		box-shadow: none;
		pointer-events: none;
	}

	.product-sticky-header:global([data-presented]) {
		visibility: visible;
	}

	.product-sticky-header:global([data-active]) {
		pointer-events: auto;
	}

	.sticky-header-minimap-action {
		position: fixed;
		z-index: 4;
		display: block;
		border-radius: var(--product-panel-radius);
		background: transparent;
		cursor: pointer;
	}

	.sticky-header-minimap-action:focus-visible {
		outline: 2px solid var(--product-accent);
		outline-offset: -3px;
	}

	.product-sticky-tabs {
		--product-tabs-dock-top-radius: var(--product-panel-radius);
		--product-tabs-dock-bottom-radius: var(--product-panel-radius);

		position: fixed;
		z-index: 19;
		box-sizing: border-box;
		height: 52px;
		padding: 0;
		border: 0;
		border-radius: var(--product-tabs-dock-top-radius) var(--product-tabs-dock-top-radius)
			var(--product-tabs-dock-bottom-radius) var(--product-tabs-dock-bottom-radius);
		overflow: clip;
		opacity: 0;
		visibility: hidden;
		background: transparent;
		box-shadow: var(--product-docked-panel-box-shadow);
		pointer-events: none;
		will-change: border-radius;
	}

	.product-sticky-header::before,
	.product-sticky-header::after,
	.product-sticky-tabs::before {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		content: '';
		pointer-events: none;
	}

	.product-sticky-header::before,
	.product-sticky-tabs::before {
		background: rgb(
			var(--product-docked-panel-tint-rgb) / var(--product-docked-panel-tint-opacity)
		);
		box-shadow: inset 0 0 0 1px
			rgb(0 0 0 / calc(var(--product-docked-panel-shadow-strength) * 0.18));
		-webkit-backdrop-filter: blur(var(--product-docked-panel-backdrop-blur));
		backdrop-filter: blur(var(--product-docked-panel-backdrop-blur));
	}

	.product-sticky-header::before {
		z-index: 2;
		opacity: var(--product-sticky-header-progress, 0);
	}

	.product-sticky-header::after {
		z-index: 1;
		box-shadow: var(--product-docked-panel-box-shadow);
		opacity: var(--product-sticky-header-progress, 0);
	}

	.product-sticky-tabs::before {
		z-index: 0;
	}

	.product-sticky-tabs::before {
		/* Shift the filtered surface itself across the physical box overlap. Chrome otherwise
		 * exposes the backdrop-filter edge as a dark one-pixel seam. */
		bottom: -1px;
		transform: translateY(-1px);
	}

	.product-sticky-tabs:global([data-active]) {
		opacity: 1;
		visibility: visible;
		pointer-events: auto;
	}

	.sticky-header-layout {
		display: grid;
		position: relative;
		z-index: 3;
		grid-template-columns: minmax(0, 1fr) 56px;
		align-items: center;
		gap: 16px;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: 14px 16px 14px var(--product-sticky-minimap-reserve, 150px);
		opacity: var(--product-sticky-header-progress, 0);
	}

	.product-sticky-tabs :global([data-product-tab-list]) {
		position: relative;
		z-index: 1;
	}

	.sticky-header-copy {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.sticky-header-kicker,
	.sticky-header-title {
		margin: 0;
		color: var(--product-ink);
	}

	.sticky-header-kicker {
		font-size: 18px;
		font-weight: 400;
		line-height: 1.1;
	}

	.sticky-header-title {
		overflow: hidden;
		font-size: 24px;
		font-weight: 520;
		line-height: 1.15;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sticky-header-action {
		display: grid;
		place-items: center;
		width: 56px;
		height: 56px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		color: var(--product-on-accent);
		background: var(--product-accent);
		text-decoration: none;
		cursor: pointer;
	}

	@media (max-width: 1100px) {
		.product-sticky-header {
			top: 8px;
			left: 8px;
			width: calc(100vw - 16px);
			height: 72px;
			border-radius: min(var(--product-panel-radius), 14px);
		}

		.sticky-header-layout {
			grid-template-columns: minmax(0, 1fr) 48px;
			gap: 8px;
			padding: 10px 10px 10px var(--product-sticky-minimap-reserve, 112px);
		}

		.sticky-header-copy {
			gap: 2px;
		}

		.sticky-header-kicker {
			font-size: 13px;
		}

		.sticky-header-title {
			font-size: 17px;
			font-weight: 600;
		}

		.sticky-header-action {
			width: 48px;
			height: 48px;
		}
	}

	@media (max-width: 460px) {
		.sticky-header-kicker {
			font-size: 12px;
		}

		.sticky-header-title {
			font-size: 15px;
		}
	}
</style>
