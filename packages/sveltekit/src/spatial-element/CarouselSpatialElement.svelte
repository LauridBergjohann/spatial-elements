<script lang="ts">
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import SpatialSummarySlot from './SpatialSummarySlot.svelte';
	import { getContext } from 'svelte';
	import { getCssPanelBoxShadow } from '@spatial-elements/core/stage/panelShadow';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { carouselKey } from '@spatial-elements/core/catalog/carouselSelection';
	import { carouselPose, carouselResident } from '@spatial-elements/core/catalog/catalogPose';
	import type { CarouselLayout, CarouselPresentation, CarouselEmphasis } from '@spatial-elements/core/catalog/catalogPose';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry,
		type CatalogEndpointRole
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
	import { useSpatialTheme } from './brandContext.js';
	let {
		spatialElement,
		sectionId,
		presentation,
		layout,
		index,
		count,
		phase,
		emphasis,
		focus,
		windowPhase,
		selected,
		interactive,
		onselect,
		canActivate
	}: {
		spatialElement: SpatialListItem;
		sectionId: string;
		presentation?: CarouselPresentation;
		layout: CarouselLayout;
		index: number;
		count: number;
		phase: number;
		emphasis?: CarouselEmphasis;
		focus: number;
		windowPhase: number;
		selected: boolean;
		interactive: boolean;
		onselect: () => void;
		canActivate: () => boolean;
	} = $props();
	const items = getContext<CatalogItems | undefined>(CATALOG_ITEMS);
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(brand));
	const contentInset = $derived(brand.panelShape.contentInset ?? Math.max(16, Math.round(brand.panelShape.radius * 0.7)));
	const catalogEndpoint = createCatalogEndpointAction();
	function address(role: CatalogEndpointRole) {
		return interactive &&
			resident &&
			pose.visible &&
			(selected || role === 'geometry' || role === 'container')
			? {
					brandId: brand.id,
					spatialElementId: spatialElement.id,
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
		if (!selected || !target || new URL(href(spatialElement.href), target).pathname !== target.pathname)
			return;
		const timer = setTimeout(() => (busy = true), 150);
		return () => clearTimeout(timer);
	});
	const occurrence = $derived(JSON.stringify([sectionId, carouselKey(spatialElement)]));
	const tooltip = $derived(spatialElement.title);
	const pose = $derived(carouselPose(index, phase, count, presentation, layout, emphasis, focus));
	const compact = $derived(layout.framing?.compact ?? false);
	const modelFrameSize = $derived(layout.framing ? Math.min(layout.framing.fit.width, layout.framing.fit.height) : Math.min(layout.width, layout.height));
	const resident = $derived(carouselResident(index, windowPhase, count, presentation, layout));
	function activate(event: MouseEvent) {
		endpoints?.prefer(brand.id, spatialElement.id, occurrence, 'carousel.front');
		sections?.activate({
			brandId: brand.id,
			spatialElementId: spatialElement.id,
			occurrence,
			slot: 'carousel.front'
		});
		(event.currentTarget as HTMLElement).focus({ preventScroll: true });
	}
	$effect(() => {
		if (!interactive || !resident) return;
		return items?.register({
			...spatialElement,
			occurrence,
			pose: { kind: 'carousel', read: () => carouselPose(index, phase, count, presentation, layout, emphasis, focus) }
		});
	});
</script>

<article
	id={`carousel-${sectionId}-${index}`}
	use:catalogEndpoint={address('container')}
	class="carousel-spatial-element"
	class:selected
	class:interactive
	hidden={interactive && !resident}
	data-carousel-spatial-element
	data-catalog-order={index}
	data-carousel-visible={interactive && pose.visible ? '' : undefined}
	data-carousel-item={carouselKey(spatialElement)}
	data-carousel-surface={brand.panelTheme.surface ?? 'glass'}
	data-carousel-theme={JSON.stringify({
		...brand.panelTheme,
		radius: radii.panel,
		tintOpacity: Math.min(brand.panelTheme.tintOpacity ?? 0.28, 0.72)
	})}
	data-catalog-occurrence={occurrence}
>
	<div
		use:catalogEndpoint={address('geometry')}
		class="spatial-element-visual"
		data-catalog-geometry
		data-spatial-element-id={spatialElement.id}
		data-catalog-occurrence={occurrence}
		style={interactive
			? `--carousel-poster-x:${pose.x * 100}%;--carousel-poster-y:${pose.y * 100}%;--carousel-poster-width:${pose.size * modelFrameSize}px;--carousel-poster-opacity:${pose.opacity}`
			: undefined}
	>
		<div data-carousel-fit-anchor aria-hidden="true"></div>
		<a
			use:mouseHover
			draggable="false"
			class="spatial-element-target"
			title={tooltip}
			hidden={interactive && !pose.visible}
			href={href(spatialElement.href)}
			role={interactive && !selected ? 'button' : undefined}
			aria-label={interactive && !selected ? `Select ${tooltip}` : `More information: ${tooltip}`}
			aria-pressed={interactive && !selected ? false : undefined}
			aria-busy={selected && busy || undefined}
			data-catalog-focus-key={`catalog-geometry:${occurrence}`}
			onpointerenter={() => { if (selected) prepare(spatialElement); }}
			onfocus={() => { if (selected) prepare(spatialElement); }}
			onpointerdown={() => { if (selected) prepare(spatialElement); }}
			onkeydown={(event) => {
				if (interactive && !selected && event.key === ' ') {
					event.preventDefault();
					event.currentTarget.click();
				}
			}}
			onclick={(event) => {
				if (!canActivate()) { event.preventDefault(); return; }
				if (interactive && !selected) { event.preventDefault(); onselect(); return; }
				activate(event);
			}}
			style:z-index={interactive ? Math.max(1, Math.round(1200 / (1 + Math.max(0, -pose.depth) / 1000))) : undefined}
		>
			{#if !spatialElement.fallbackImage}<span>{spatialElement.eyebrow}</span>{/if}
		</a>
		{#if spatialElement.fallbackImage}<img
					hidden={interactive && !pose.visible}
					class="spatial-element-poster"
					draggable="false"
					src={spatialElement.fallbackImage}
					alt={`${brand.name} ${spatialElement.title}`}
					style:--carousel-depth-blur={interactive && pose.blur ? `blur(${pose.blur}px)` : 'blur(0px)'}
					width="320"
					height="320"
				/>{/if}
	</div>
	<div
		class="summary"
		class:has-eyebrow={Boolean(spatialElement.eyebrow)}
		class:has-section-link={Boolean(spatialElement.summary?.sectionLink)}
		style:--summary-content-inset={`${contentInset}px`}
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
		style:--carousel-focus-blur={interactive && pose.panelOpacity < 1 ? `blur(${(1 - pose.panelOpacity) * 6}px)` : 'none'}
		style:--carousel-panel-radius={radii.panel + 'px'}
		use:catalogEndpoint={address('summary-surface')}
	>
		<SpatialSummarySlot instanceKey={`carousel:${brand.id}:${occurrence}`}
   context={{ spatialElement: { id: spatialElement.id, brandId: brand.id, eyebrow: spatialElement.eyebrow, title: spatialElement.title,
    features: spatialElement.summary?.features ?? spatialElement.features.map((label) => ({ label })), action: spatialElement.summary?.action },
    contentInset, heading: 'h3', mode: 'carousel', address,
    carousel: { item: spatialElement, occurrence, compact } }} />
	</div>
</article>

<style>
	.carousel-spatial-element {
		display: block;
		position: relative;
		min-width: 0;
		height: calc(var(--spatial-carousel-title-reserve) + var(--spatial-carousel-fit-height));
		min-height: 0;
		padding: 0;
		box-sizing: border-box;
		scroll-snap-align: start;
		scroll-snap-stop: always;
		scroll-margin-top: 100px;
	}
	.interactive {
		grid-area: 1 / 1;
		pointer-events: none;
	}
	.spatial-element-visual {
		position: absolute;
		inset: 0;
		display: block;
		place-items: center;
		touch-action: manipulation;
	}
	.interactive .spatial-element-visual {
		/* The native rail owns horizontal panning; vertical page scroll and zoom stay native. */
		touch-action: manipulation;
	}
	.interactive[hidden] {
		/* Keep known summary dimensions measurable without painting or registering GPU actors. */
		display: grid;
		visibility: hidden;
	}
	.interactive .summary {
		z-index: 1400;
		transform-origin: 0 0;
	}
	.spatial-element-target,
	.spatial-element-poster {
		position: absolute;
		left: var(--carousel-poster-x, calc(var(--spatial-carousel-fit-left) + var(--spatial-carousel-fit-width) / 2));
		top: var(--carousel-poster-y, calc(var(--spatial-carousel-title-reserve) + var(--spatial-carousel-fit-height) / 2));
		width: var(--carousel-poster-width, calc(min(var(--spatial-carousel-fit-width), var(--spatial-carousel-fit-height)) * 0.82));
		max-width: none;
		transform: translate(-50%, -50%);
		aspect-ratio: 1;
	}
	.spatial-element-target {
		display: block;
		color: inherit;
		text-decoration: none;
		border: none;
		background: transparent;
		cursor: pointer;
		pointer-events: auto;
		padding: 0;
		aspect-ratio: 1;
	}
	.spatial-element-target[hidden] {
		display: none;
	}
	.spatial-element-target:focus-visible {
		outline: 2px solid var(--spatial-element-accent);
		outline-offset: 4px;
		border-radius: var(--spatial-element-control-radius);
	}
	/* Enhanced geometry already has a silhouette focus outline in the renderer. */
	.interactive:global([data-catalog-model-ready]) .spatial-element-target:focus-visible {
		outline: none;
	}
	img {
		opacity: var(--carousel-poster-opacity, 1);
		height: auto;
		pointer-events: none;
		object-fit: contain;
		filter: var(--carousel-hover-blur, var(--carousel-depth-blur, blur(0px))) var(--carousel-hover-shadow, drop-shadow(0 0 0 transparent));
		transition: filter 180ms ease, opacity 240ms ease;
	}
	.spatial-element-target:global([data-mouse-hover]) + img,
	.spatial-element-target:focus-visible + img {
		--carousel-hover-blur: blur(0px);
		--carousel-hover-shadow: drop-shadow(0 0 3px var(--spatial-element-accent));
	}
	.interactive:global([data-catalog-model-ready]) img {
		opacity: 0;
		/* The GPU replaces the poster in this frame. Fading it would draw a second
		   product beneath the moving model when a return transition releases it. */
		transition: filter 180ms ease;
	}
	.summary {
		position: absolute;
		left: var(--spatial-carousel-summary-left);
		top: calc(var(--spatial-carousel-title-reserve) - var(--spatial-carousel-compact-height));
		width: var(--spatial-carousel-summary-width);
		height: var(--spatial-carousel-compact-height);
		min-height: 0;
		margin: 0;
		--spatial-carousel-compact-height: 40px;
		box-sizing: border-box;
		filter: var(--carousel-focus-blur, none);

		border-radius: var(--carousel-panel-radius, 14px);
		padding: 0;

		color: color-mix(in srgb, var(--spatial-element-ink) 92%, transparent);
		pointer-events: auto;
	}
	.summary[hidden] {
		display: block;
		visibility: hidden;
	}
	.has-eyebrow { --spatial-carousel-compact-height: 66px; }
	[data-carousel-fit-anchor] { position: absolute; left: var(--spatial-carousel-fit-left); top: var(--spatial-carousel-title-reserve); width: var(--spatial-carousel-fit-width); height: var(--spatial-carousel-fit-height); pointer-events: none; }
	@media (min-width: 840px) {
		.summary { top: calc(var(--spatial-carousel-fit-height) / 2); height: auto; max-height: var(--spatial-carousel-fit-height); padding: 0; transform: translateY(-50%); }
		.summary.has-section-link { --spatial-summary-height-reserve: 32px; }
	}
	@media (prefers-reduced-motion: reduce) {
		img { transition: none; }
	}
</style>
