<script lang="ts">
	import { getContext } from 'svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	let {
		spatialElement,
		occurrence,
		order = 0
	}: { spatialElement: SpatialListItem; occurrence: string; order?: number } = $props();
	const brand = useSpatialTheme();
	const catalogEndpoint = createCatalogEndpointAction();
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const { href, prepare, pending } = useCatalogNavigation();
	const resolve = href;
	let busySpatialElement = $state<string>();
	$effect(() => items?.register({ ...spatialElement, occurrence }));
	$effect(() => {
		const target = pending();
		busySpatialElement = undefined;
		if (!target || new URL(href(spatialElement.href), target).pathname !== target.pathname) return;
		const timer = setTimeout(() => (busySpatialElement = spatialElement.id), 150);
		return () => clearTimeout(timer);
	});
</script>

<a
	use:catalogEndpoint={{
		brandId: brand.id,
		spatialElementId: spatialElement.id,
		slot: 'catalog.card',
		occurrence,
		role: 'container'
	}}
	class="spatial-element-card"
	href={resolve(spatialElement.href)}
	onpointerenter={() => prepare(spatialElement)}
	onfocus={(event) => {
		if (!event.currentTarget.hasAttribute('data-catalog-restoring-focus')) prepare(spatialElement);
	}}
	onpointerdown={() => prepare(spatialElement)}
	onclick={(event) => {
		endpoints?.prefer(brand.id, spatialElement.id, occurrence);
		sections?.activate({
			brandId: brand.id,
			spatialElementId: spatialElement.id,
			occurrence,
			slot: 'catalog.card'
		});
		// Touch activation need not focus links natively; record the same history origin as keyboard use.
		event.currentTarget.focus({ preventScroll: true });
	}}
	aria-busy={busySpatialElement === spatialElement.id ? true : undefined}
	data-catalog-card
	data-catalog-order={order}
	data-catalog-occurrence={occurrence}
	data-spatial-element-id={spatialElement.id}
	data-catalog-focus-key={`catalog:${JSON.stringify([brand.id, spatialElement.id, occurrence])}`}
	aria-labelledby={`catalog-spatial-element-${encodeURIComponent(occurrence)}`}
>
	{#if busySpatialElement === spatialElement.id}
		<span class="catalog-loading" aria-hidden="true"></span>
	{/if}
	<div
		class="spatial-element-card-surface"
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
			spatialElementId: spatialElement.id,
			slot: 'catalog.card',
			occurrence,
			role: 'summary-surface'
		}}
		data-shared-role="summary-surface"
		data-spatial-element-id={spatialElement.id}
		aria-hidden="true"
	></div>
	<div
		class="spatial-element-card-geometry"
		use:catalogEndpoint={{
			brandId: brand.id,
			spatialElementId: spatialElement.id,
			slot: 'catalog.card',
			occurrence,
			role: 'geometry'
		}}
		data-catalog-geometry
		data-catalog-occurrence={occurrence}
		data-spatial-element-id={spatialElement.id}
		data-catalog-slot="catalog.card"
	>
		{#if spatialElement.stage?.fallbackImage}
			<img
				class="catalog-poster"
				data-catalog-poster
				loading="lazy"
				decoding="async"
				src={spatialElement.stage.fallbackImage}
				alt={`${brand.name} ${spatialElement.title}`}
			/>
		{/if}
	</div>
	<div class="spatial-element-card-copy">
		<p
			class="spatial-element-card-eyebrow"
			data-shared-role="eyebrow"
			data-spatial-element-id={spatialElement.id}
			use:catalogEndpoint={{
				brandId: brand.id,
				spatialElementId: spatialElement.id,
				slot: 'catalog.card',
				occurrence,
				role: 'eyebrow'
			}}
		>
			{spatialElement.eyebrow}
		</p>
		<h3
			use:catalogEndpoint={{
				brandId: brand.id,
				spatialElementId: spatialElement.id,
				slot: 'catalog.card',
				occurrence,
				role: 'title'
			}}
			id={`catalog-spatial-element-${encodeURIComponent(occurrence)}`}
			data-shared-role="title"
			data-spatial-element-id={spatialElement.id}
		>
			{spatialElement.title}
		</h3>
	</div>
</a>
<span class="catalog-status" role="status">{busySpatialElement ? 'Opening spatialElement…' : ''}</span>

<style>
	.spatial-element-card-eyebrow {
		margin: 0;
		color: var(--spatial-element-accent);
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
		border: 2px solid color-mix(in srgb, var(--spatial-element-accent) 20%, transparent);
		border-top-color: var(--spatial-element-accent);
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

	.spatial-element-card {
		position: relative;
		display: block;
		box-sizing: border-box;
		min-width: 0;
		max-width: 360px;
		border-radius: var(--spatial-element-panel-radius, 12px);
		color: var(--spatial-element-ink);
		text-decoration: none;
		transform-origin: center;
		transform: perspective(1000px) translate3d(0, var(--catalog-lift, 0px), 0)
			rotateX(var(--catalog-rotate-x, 0deg)) rotateY(var(--catalog-rotate-y, 0deg));
	}

	.spatial-element-card:focus-visible {
		outline: 3px solid var(--spatial-element-accent);
		outline-offset: 5px;
	}

	.spatial-element-card-surface {
		position: absolute;
		inset: 0;
		z-index: -1;
		border: 1px solid color-mix(in srgb, var(--spatial-element-ink) 12%, transparent);
		border-radius: inherit;
		background: color-mix(
			in srgb,
			var(--card-panel-tint) var(--card-panel-tint-opacity),
			transparent
		);
		box-shadow: 0 12px 32px rgb(0 0 0 / 0.06);
		pointer-events: none;
	}

	.spatial-element-card-geometry {
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

	.spatial-element-card:global([data-catalog-model-ready]) .catalog-poster {
		opacity: 0;
	}

	.spatial-element-card-copy {
		padding: 14px 22px 24px;
	}

	h3 {
		margin: 8px 0 0;
		font-size: 21px;
		font-weight: 720;
		line-height: 1.24;
	}

	@media (prefers-reduced-motion: reduce) {
		.spatial-element-card {
			transform: none;
		}
	}
</style>
