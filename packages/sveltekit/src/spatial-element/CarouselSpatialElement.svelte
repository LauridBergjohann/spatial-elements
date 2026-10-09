<script lang="ts">
	import { catalogActionSemantic } from '@spatial-elements/core/catalog/catalogAction';
	import { getContext } from 'svelte';
	import { getCssPanelBoxShadow } from '@spatial-elements/core/stage/panelShadow';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
	import { CATALOG_ITEMS, type CatalogItems } from '@spatial-elements/core/catalog/catalogItems';
	import { carouselKey } from '@spatial-elements/core/catalog/carouselSelection';
	import { carouselPose, carouselResident } from '@spatial-elements/core/catalog/catalogPose';
	import type { CarouselLayout, CarouselPresentation } from '@spatial-elements/core/catalog/catalogPose';
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
	const tooltip = $derived([spatialElement.eyebrow, spatialElement.title].filter(Boolean).join(' — '));
	const pose = $derived(carouselPose(index, phase, count, presentation, layout));
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
			pose: { kind: 'carousel', read: () => carouselPose(index, phase, count, presentation, layout) }
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
		radius: brand.panelShape.radius,
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
			? `--carousel-poster-x:${(pose.x - 0.19) * 100}%;--carousel-poster-mobile-x:${pose.x * 100}%;--carousel-poster-y:${pose.y * 100}%;--carousel-poster-size:${pose.size};--carousel-poster-opacity:${pose.opacity}`
			: undefined}
	>
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
			style:z-index={interactive ? Math.round(1300 + pose.depth) : undefined}
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
		style:--carousel-panel-radius={brand.panelShape.radius + 'px'}
		use:catalogEndpoint={address('summary-surface')}
	>
		<p class="eyebrow" use:catalogEndpoint={address('eyebrow')}>{spatialElement.eyebrow}</p>
		<h3 use:catalogEndpoint={address('title')}>{spatialElement.title}</h3>
		<ul
			use:catalogEndpoint={address('features')}
			data-catalog-rich-shared="features"
			data-catalog-semantic={JSON.stringify(
				spatialElement.summary?.features ?? spatialElement.features.map((label) => ({ label }))
			)}
		>
			{#each spatialElement.summary?.features ?? spatialElement.features.map( (label) => ({ label }) ) as feature, index (index)}<li
				>
					{feature.label}
				</li>{/each}
		</ul>
		{#if spatialElement.summary?.action}
			{@const action = spatialElement.summary.action}
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
			data-catalog-focus-key={`catalog:${JSON.stringify([brand.id, spatialElement.id, occurrence, 'carousel.front'])}`}
			aria-busy={busy || undefined}
			onclick={activate}
			class="information"
			href={href(spatialElement.href)}
			onpointerenter={() => prepare(spatialElement)}
			onfocus={() => prepare(spatialElement)}
			onpointerdown={() => prepare(spatialElement)}
			>More information<span class="sr-only">: {spatialElement.title}</span></a
		>
		{#if spatialElement.summary?.sectionLink}
			<a
				class="information"
				href={href(spatialElement.summary.sectionLink.href)}
				onclick={activate}
				data-catalog-focus-key={`catalog-section:${occurrence}`}
				>{spatialElement.summary.sectionLink.label}</a
			>
		{/if}
	</div>
</article>

<style>
	.carousel-spatial-element {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: 1fr;
		align-items: center;
		position: relative;
		min-width: 0;
		min-height: 560px;
		padding: 32px 0;
		box-sizing: border-box;
		scroll-snap-align: start;
		scroll-margin-top: 100px;
	}
	.interactive {
		grid-area: 1 / 1;
		pointer-events: none;
	}
	.spatial-element-visual {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		touch-action: manipulation;
	}
	.interactive .spatial-element-visual {
		/* One owner for diagonal single-finger motion; two-finger page zoom stays native. */
		touch-action: pinch-zoom;
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
		left: var(--carousel-poster-x, 31%);
		top: var(--carousel-poster-y, 50%);
		width: calc(var(--carousel-poster-size, 0.82) * 100cqw);
		max-width: calc(var(--carousel-poster-size, 0.82) * 560px);
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
		border-radius: 12px;
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
	}
	.summary {
		position: relative;
		width: 40%;
		margin-left: 50%;
		box-sizing: border-box;
		filter: var(--carousel-focus-blur, none);

		border-radius: var(--carousel-panel-radius, 14px);
		padding: 28px;

		color: var(--spatial-element-ink);
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
		border: 1px solid color-mix(in srgb, var(--spatial-element-accent) 12%, transparent);
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
		background: var(--spatial-element-accent);
		color: white;
		text-align: center;
		text-decoration: none;
		font: inherit;
		font-weight: 650;
	}
	.information {
		display: inline-block;
		margin-top: 20px;
		color: var(--spatial-element-accent);
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
		.carousel-spatial-element {
			min-height: 0;
			padding: 360px 0 48px;
			align-items: start;
		}
		.summary {
			width: 92%;
			margin-left: 4%;
		}
		.spatial-element-target,
		.spatial-element-poster {
			left: var(--carousel-poster-mobile-x, 50%);
			top: 180px;
			max-width: calc(var(--carousel-poster-size, 0.82) * 360px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		img { transition: none; }
	}
</style>
