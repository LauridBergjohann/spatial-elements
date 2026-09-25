<script lang="ts">
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import { getContext } from 'svelte';
	import { getCssPanelBoxShadow } from '@spatial-elements/core/stage/panelShadow';
	import type { ProductOverviewItem } from '@spatial-elements/core/product-detail/types';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { carouselKey } from '@spatial-elements/core/catalog/carouselSelection';
	import { carouselPose, carouselResident } from '@spatial-elements/core/catalog/catalogPose';
	import type { CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry,
		type CatalogEndpointRole
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import { useProductBrand } from './brandContext.js';
	let {
		product,
		sectionId,
		presentation,
		index,
		count,
		phase,
		windowPhase,
		selected,
		interactive,
		onselect
	}: {
		product: ProductOverviewItem;
		sectionId: string;
		presentation?: CarouselPresentation;
		index: number;
		count: number;
		phase: number;
		windowPhase: number;
		selected: boolean;
		interactive: boolean;
		onselect: () => void;
	} = $props();
	const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const brand = useProductBrand();
	const catalogEndpoint = createCatalogEndpointAction();
	function address(role: CatalogEndpointRole) {
		return interactive &&
			resident &&
			pose.visible &&
			(selected || role === 'geometry' || role === 'container')
			? {
					brandId: brand.id,
					productId: product.id,
					occurrence,
					slot: selected ? ('carousel.front' as const) : ('carousel.neighbour' as const),
					role
				}
			: undefined;
	}
	const { href, prepare, pending } = useCatalogNavigation();
	let busy = $state(false);
	$effect(() => {
		const target = pending();
		busy = false;
		if (!selected || !target || new URL(href(product.href), target).pathname !== target.pathname)
			return;
		const timer = setTimeout(() => (busy = true), 150);
		return () => clearTimeout(timer);
	});
	const occurrence = $derived(JSON.stringify([sectionId, carouselKey(product)]));
	const pose = $derived(carouselPose(index, phase, count, presentation));
	const resident = $derived(carouselResident(index, windowPhase, count));
	function activate(event: MouseEvent) {
		endpoints?.prefer(brand.id, product.id, occurrence, 'carousel.front');
		sections?.activate({
			brandId: brand.id,
			productId: product.id,
			occurrence,
			slot: 'carousel.front'
		});
		(event.currentTarget as HTMLElement).focus({ preventScroll: true });
	}
	$effect(() => {
		if (!interactive || !resident) return;
		return items?.register({
			...product,
			occurrence,
			pose: { kind: 'carousel', read: () => carouselPose(index, phase, count, presentation) }
		});
	});
</script>

<article
	use:catalogEndpoint={address('container')}
	class="carousel-product"
	class:selected
	class:interactive
	hidden={interactive && !resident}
	data-carousel-product
	data-catalog-order={index}
	data-carousel-visible={interactive && pose.visible ? '' : undefined}
	data-carousel-item={carouselKey(product)}
	data-carousel-surface={brand.panelTheme.surface ?? 'glass'}
	data-carousel-theme={JSON.stringify({
		...brand.panelTheme,
		radius: brand.panelShape.radius,
		tintOpacity: Math.min(brand.panelTheme.tintOpacity ?? 0.28, 0.72)
	})}
	data-catalog-occurrence={occurrence}
>
	<div
		use:catalogEndpoint={address('geometry')}
		class="product-visual"
		data-catalog-geometry
		data-product-id={product.id}
		data-catalog-occurrence={occurrence}
	>
		<button
			draggable="false"
			class="product-target"
			hidden={interactive && !pose.visible}
			aria-label={`Select ${product.eyebrow}`}
			aria-pressed={selected}
			onclick={onselect}
			style={interactive
				? `left:${(pose.x - 0.19 * Math.cos(pose.yaw)) * 100}%;top:${pose.y * 100}%;width:${pose.size * 100}%;max-width:${pose.size * 480}px;z-index:${Math.round(1300 + pose.depth)}`
				: undefined}
		>
			{#if product.stage?.fallbackImage}<img
					draggable="false"
					src={product.stage.fallbackImage}
					alt={`${brand.name} ${product.title}`}
					width="320"
					height="320"
				/>{:else}<span>{product.eyebrow}</span>{/if}
		</button>
	</div>
	<div
		class="summary"
		hidden={interactive && pose.panelOpacity < 0.001}
		inert={interactive && !selected}
		aria-hidden={interactive && !selected}
		style:--carousel-panel-opacity={(interactive ? pose.panelOpacity : 1) *
			(brand.panelTheme.opacity ?? 1)}
		style:--carousel-panel-shadow={getCssPanelBoxShadow(brand.panelTheme.shadowIntensity ?? 0.28)}
		style:--carousel-panel-tint={typeof brand.panelTheme.tint === 'number'
			? '#' + brand.panelTheme.tint.toString(16).padStart(6, '0')
			: typeof brand.panelTheme.tint === 'object'
				? brand.panelTheme.tint.getStyle()
				: (brand.panelTheme.tint ?? '#ffffff')}
		style:--carousel-panel-tint-opacity={Math.min(brand.panelTheme.tintOpacity ?? 0.28, 0.72) *
			100 +
			'%'}
		style:--carousel-panel-blur={(brand.panelTheme.backdropBlur ?? 5) + 'px'}
		style:--carousel-panel-radius={brand.panelShape.radius + 'px'}
		use:catalogEndpoint={address('summary-surface')}
	>
		<p class="eyebrow" use:catalogEndpoint={address('eyebrow')}>{product.eyebrow}</p>
		<h3 use:catalogEndpoint={address('title')}>{product.title}</h3>
		<ul
			use:catalogEndpoint={address('features')}
			data-catalog-rich-shared="features"
			data-catalog-semantic={JSON.stringify(
				product.summary?.features ?? product.features.map((label) => ({ label }))
			)}
		>
			{#each product.summary?.features ?? product.features.map( (label) => ({ label }) ) as feature, index (index)}<li
				>
					{feature.label}
				</li>{/each}
		</ul>
		{#if product.summary?.action}
			{@const action = product.summary.action}
			{#if action.href}<a
					use:catalogEndpoint={address('primary-action')}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(action)}
					class="action"
					href={action.href}
					rel="external"
					aria-label={action.ariaLabel}>{action.label}</a
				>
			{:else}<button
					class="action"
					aria-label={action.ariaLabel}
					use:catalogEndpoint={address('primary-action')}
					data-catalog-rich-shared="primary-action"
					data-catalog-semantic={catalogActionSemantic(action)}>{action.label}</button
				>{/if}
		{/if}
		<a
			data-catalog-focus-key={`catalog:${JSON.stringify([brand.id, product.id, occurrence, 'carousel.front'])}`}
			aria-busy={busy || undefined}
			onclick={(event) => {
				endpoints?.prefer(brand.id, product.id, occurrence, 'carousel.front');
				sections?.activate({
					brandId: brand.id,
					productId: product.id,
					occurrence,
					slot: 'carousel.front'
				});
				event.currentTarget.focus({ preventScroll: true });
			}}
			class="information"
			href={href(product.href)}
			onpointerenter={() => prepare(product)}
			onfocus={() => prepare(product)}
			onpointerdown={() => prepare(product)}
			>More information<span class="sr-only">: {product.title}</span></a
		>
		{#if product.summary?.sectionLink}
			<a
				class="information"
				href={href(product.summary.sectionLink.href)}
				onclick={activate}
				data-catalog-focus-key={`catalog-section:${occurrence}`}
				>{product.summary.sectionLink.label}</a
			>
		{/if}
	</div>
</article>

<style>
	.carousel-product {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(280px, 0.7fr);
		gap: 32px;
		align-items: center;
		margin-bottom: 24px;
	}
	.interactive {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.product-visual {
		height: var(--carousel-height, 560px);
		position: relative;
		display: grid;
		place-items: center;
		touch-action: pan-y;
	}
	.interactive {
		display: block;
		margin: 0;
	}
	.interactive[hidden] {
		/* Keep known summary dimensions measurable without painting or registering GPU actors. */
		display: block;
		visibility: hidden;
	}
	.interactive .summary {
		position: absolute;
		left: 0;
		top: 0;
		width: 40%;
		box-sizing: border-box;
		z-index: 1400;
		transform-origin: 0 0;
		transform: translate(150%, 24px);
	}
	.product-target {
		border: none;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
		padding: 0;
		aspect-ratio: 1;
	}
	.interactive .product-target {
		position: absolute;
		transform: translate(-50%, -50%);
	}
	.product-target[hidden] {
		display: none;
	}
	.product-target:focus-visible {
		outline: 2px solid var(--product-accent);
		outline-offset: 4px;
		border-radius: 12px;
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.carousel-product:global([data-catalog-model-ready]) img {
		opacity: 0;
	}
	.summary {
		position: relative;

		border-radius: var(--carousel-panel-radius, 14px);
		padding: 28px;

		color: var(--product-ink);
		pointer-events: auto;
	}
	.summary::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: color-mix(
			in srgb,
			var(--carousel-panel-tint, white) var(--carousel-panel-tint-opacity, 65%),
			transparent
		);
		border: 1px solid color-mix(in srgb, var(--product-accent) 12%, transparent);
		backdrop-filter: blur(var(--carousel-panel-blur, 5px));
		box-shadow: var(--carousel-panel-shadow);
		opacity: var(--carousel-panel-opacity, 1);
		pointer-events: none;
	}
	.summary > :global(*) {
		position: relative;
		opacity: var(--carousel-panel-opacity, 1);
	}
	:global([data-carousel-glass-ready]) .summary::before {
		visibility: hidden;
	}
	.summary[hidden] {
		display: block;
		visibility: hidden;
	}
	.eyebrow {
		font-weight: 720;
		font-size: 13px;
	}
	h3 {
		font-size: clamp(24px, 2.5vw, 36px);
		line-height: 1.15;
		margin: 12px 0 28px;
	}
	ul {
		padding-left: 20px;
		line-height: 1.6;
	}
	li {
		margin: 12px 0;
	}
	.action {
		display: block;
		width: 100%;
		box-sizing: border-box;
		padding: 14px;
		margin-top: 24px;
		border: 0;
		border-radius: 8px;
		background: var(--product-accent);
		color: white;
		text-align: center;
		text-decoration: none;
		font: inherit;
		font-weight: 650;
	}
	.information {
		display: inline-block;
		margin-top: 20px;
		color: var(--product-accent);
	}
	.information[aria-busy='true'] {
		opacity: 0.55;
		cursor: progress;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	@container (max-width: 700px) {
		.interactive .summary {
			width: 92%;
		}
	}
	@media (max-width: 850px) {
		.carousel-product {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}
</style>
