<script lang="ts">
	import { getContext } from 'svelte';
	import { useProductBrand } from './brandContext.js';
	import type { ProductOverviewItem } from '@spatial-elements/core/product-detail/types';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	let {
		product,
		occurrence,
		order = 0
	}: { product: ProductOverviewItem; occurrence: string; order?: number } = $props();
	const brand = useProductBrand();
	const catalogEndpoint = createCatalogEndpointAction();
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const { href, prepare, pending } = useCatalogNavigation();
	const resolve = href;
	let busyProduct = $state<string>();
	$effect(() => items?.register({ ...product, occurrence }));
	$effect(() => {
		const target = pending();
		busyProduct = undefined;
		if (!target || new URL(href(product.href), target).pathname !== target.pathname) return;
		const timer = setTimeout(() => (busyProduct = product.id), 150);
		return () => clearTimeout(timer);
	});
</script>

<a
	use:catalogEndpoint={{
		brandId: brand.id,
		productId: product.id,
		slot: 'catalog.card',
		occurrence,
		role: 'container'
	}}
	class="product-card"
	href={resolve(product.href)}
	onpointerenter={() => prepare(product)}
	onfocus={(event) => {
		if (!event.currentTarget.hasAttribute('data-catalog-restoring-focus')) prepare(product);
	}}
	onpointerdown={() => prepare(product)}
	onclick={(event) => {
		endpoints?.prefer(brand.id, product.id, occurrence);
		sections?.activate({
			brandId: brand.id,
			productId: product.id,
			occurrence,
			slot: 'catalog.card'
		});
		// Touch activation need not focus links natively; record the same history origin as keyboard use.
		event.currentTarget.focus({ preventScroll: true });
	}}
	aria-busy={busyProduct === product.id ? true : undefined}
	data-catalog-card
	data-catalog-order={order}
	data-catalog-occurrence={occurrence}
	data-product-id={product.id}
	data-catalog-focus-key={`catalog:${JSON.stringify([brand.id, product.id, occurrence])}`}
	aria-labelledby={`catalog-product-${encodeURIComponent(occurrence)}`}
>
	{#if busyProduct === product.id}
		<span class="catalog-loading" aria-hidden="true"></span>
	{/if}
	<div
		class="product-card-surface"
		style:--card-panel-tint={typeof brand.panelTheme.tint === 'number'
			? '#' + brand.panelTheme.tint.toString(16).padStart(6, '0')
			: typeof brand.panelTheme.tint === 'object'
				? brand.panelTheme.tint.getStyle()
				: (brand.panelTheme.tint ?? '#ffffff')}
		style:--card-panel-tint-opacity={Math.min(
			1,
			Math.max(0, brand.panelTheme.tintOpacity ?? 0.28)
		) *
			100 +
			'%'}
		use:catalogEndpoint={{
			brandId: brand.id,
			productId: product.id,
			slot: 'catalog.card',
			occurrence,
			role: 'summary-surface'
		}}
		data-shared-role="summary-surface"
		data-product-id={product.id}
		aria-hidden="true"
	></div>
	<div
		class="product-card-geometry"
		use:catalogEndpoint={{
			brandId: brand.id,
			productId: product.id,
			slot: 'catalog.card',
			occurrence,
			role: 'geometry'
		}}
		data-catalog-geometry
		data-catalog-occurrence={occurrence}
		data-product-id={product.id}
		data-catalog-slot="catalog.card"
	>
		{#if product.stage?.fallbackImage}
			<img
				class="catalog-poster"
				data-catalog-poster
				loading="lazy"
				decoding="async"
				src={product.stage.fallbackImage}
				alt={`${brand.name} ${product.title}`}
			/>
		{/if}
	</div>
	<div class="product-card-copy">
		<p
			class="product-card-eyebrow"
			data-shared-role="eyebrow"
			data-product-id={product.id}
			use:catalogEndpoint={{
				brandId: brand.id,
				productId: product.id,
				slot: 'catalog.card',
				occurrence,
				role: 'eyebrow'
			}}
		>
			{product.eyebrow}
		</p>
		<h3
			use:catalogEndpoint={{
				brandId: brand.id,
				productId: product.id,
				slot: 'catalog.card',
				occurrence,
				role: 'title'
			}}
			id={`catalog-product-${encodeURIComponent(occurrence)}`}
			data-shared-role="title"
			data-product-id={product.id}
		>
			{product.title}
		</h3>
	</div>
</a>
<span class="catalog-status" role="status">{busyProduct ? 'Opening product…' : ''}</span>

<style>
	.product-card-eyebrow {
		margin: 0;
		color: var(--product-accent);
		font-size: 13px;
		font-weight: 720;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.catalog-loading {
		position: absolute;
		right: 14px;
		top: 14px;
		width: 18px;
		height: 18px;
		border: 2px solid color-mix(in srgb, var(--product-accent) 20%, transparent);
		border-top-color: var(--product-accent);
		border-radius: 50%;
		animation: catalog-loading-spin 0.8s linear infinite;
	}
	.catalog-status {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	@keyframes catalog-loading-spin {
		to {
			transform: rotate(360deg);
		}
	}

	.product-card {
		position: relative;
		display: block;
		box-sizing: border-box;
		min-width: 0;
		max-width: 360px;
		border-radius: var(--product-panel-radius, 12px);
		color: var(--product-ink);
		text-decoration: none;
		transform-origin: center;
		transform: perspective(1000px) translate3d(0, var(--catalog-lift, 0px), 0)
			rotateX(var(--catalog-rotate-x, 0deg)) rotateY(var(--catalog-rotate-y, 0deg));
	}

	.product-card:focus-visible {
		outline: 3px solid var(--product-accent);
		outline-offset: 5px;
	}

	.product-card-surface {
		position: absolute;
		inset: 0;
		z-index: -1;
		border: 1px solid color-mix(in srgb, var(--product-ink) 12%, transparent);
		border-radius: inherit;
		background: color-mix(
			in srgb,
			var(--card-panel-tint) var(--card-panel-tint-opacity),
			transparent
		);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.06);
		pointer-events: none;
	}

	.product-card-geometry {
		position: relative;
		height: 228px;
		margin: 12px 12px 0;
		pointer-events: none;
	}

	.catalog-poster {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}

	.product-card:global([data-catalog-model-ready]) .catalog-poster {
		opacity: 0;
	}

	.product-card-copy {
		padding: 14px 22px 24px;
	}

	h3 {
		margin: 8px 0 0;
		font-size: 21px;
		font-weight: 720;
		line-height: 1.24;
	}

	@media (prefers-reduced-motion: reduce) {
		.product-card {
			transform: none;
		}
	}
</style>
