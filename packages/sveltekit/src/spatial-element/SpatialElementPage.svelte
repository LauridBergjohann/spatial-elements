<script lang="ts">
	import { getContext, onMount, setContext } from 'svelte';
	import { ShoppingCart } from 'lucide-svelte';
	import { SpatialElementPaneController } from '@spatial-elements/core/spatial-element/SpatialElementPaneController';
	import { resolveActiveDetailSection } from '@spatial-elements/core/spatial-element/activeDetailSection';
	import { resolveDetailLayout } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import {
		CATALOG_ENDPOINTS,
		type CatalogEndpointRegistry
	} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import type { Snippet } from 'svelte';
	import StageViewport from '../stage/StageViewport.svelte';
	import {
		STAGE_ANCHOR_NAVIGATION_END_EVENT,
		STAGE_ANCHOR_NAVIGATION_EVENT,
		type StageAnchorNavigationDetail
	} from '@spatial-elements/core/stage/scrollAnimation';
	import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementMediaRail from './SpatialElementMediaRail.svelte';
	import SpatialElementNativeMedia from './SpatialElementNativeMedia.svelte';
	import { resolveSpatialElementMedia } from '@spatial-elements/core/spatial-element/spatialElementMedia';
	import SpatialElementSummaryPanel from './SpatialElementSummaryPanel.svelte';
	import SpatialElementHelp from './SpatialElementHelp.svelte';
	import SpatialElementStickyHeader from './SpatialElementStickyHeader.svelte';
	import SpatialElementTabs from './SpatialElementTabs.svelte';
	import SectionSurfaceGroup from './SectionSurfaceGroup.svelte';
	import './layout.generated.css';
	import { SpatialElementDockController } from '@spatial-elements/core/spatial-element/SpatialElementDockController';
	import { SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, SpatialElementSectionRegistry } from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	import type { SpatialElementData, SpatialElementMediaItem, SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';
	import { resolveSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import { registerSpatialPage } from './spatialPageContext.js';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';

	const SPATIAL_ELEMENT_OVERVIEW_SECTION = {
		id: 'overview',
		title: 'Übersicht'
	} satisfies SpatialElementSectionNavigationItem;

	interface Props {
		/** Complete element document from this page's load function. Registers assets with the enclosing shell. */
		spatialElement: SpatialElementData;
		/** Detail sections; Section components automatically populate the tab navigation. */
		children?: Snippet;
	}
	let { spatialElement: element, children }: Props = $props();
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	const spatialElement = $derived.by(() => {
		const resolved = resolveSpatialElementData(element, brand.id);
		return { ...resolved, media: resolveSpatialElementMedia(resolved.media) };
	});
	let mediaSelection = $state<{ elementId: string; mediaId: string }>();
	const selectedMedia = $derived(spatialElement.media.find(media =>
		mediaSelection?.elementId === spatialElement.id && media.id === mediaSelection.mediaId) ?? spatialElement.media[0]);
	function selectMedia(media: SpatialElementMediaItem) {
		mediaSelection = { elementId: spatialElement.id, mediaId: media.id };
	}
	$effect(() => { if (mediaSelection?.elementId !== element?.id) mediaSelection = undefined; });
	// During route teardown Kit can clear the outgoing page's data before unmount.
	// Read raw assets here, so the parent stage never evaluates outgoing DOM-derived content.
	registerSpatialPage(() => element ? { kind: 'detail', element } : { kind: 'content', hdr: '' });
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const stageContext = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	let sections = $state<SpatialElementSectionNavigationItem[]>([]);
	let activeSectionId = $state<string | undefined>(SPATIAL_ELEMENT_OVERVIEW_SECTION.id);
	let mainElement: HTMLElement;
	let splitPane = $state(false);
	let paneController = $state.raw<SpatialElementPaneController>();
	const paneTint = $derived(typeof brand.panelTheme.tint === 'number'
		? `#${brand.panelTheme.tint.toString(16).padStart(6, '0')}`
		: typeof brand.panelTheme.tint === 'object' ? brand.panelTheme.tint.getStyle()
			: brand.panelTheme.tint ?? '#ffffff');
	let navigationTargetId: string | undefined;
	let scrollSpyFrame = 0;
	const navigationSections = $derived([SPATIAL_ELEMENT_OVERVIEW_SECTION, ...sections]);

	const sectionRegistry = new SpatialElementSectionRegistry((nextSections) => {
		sections = nextSections;
	});
	setContext(SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, sectionRegistry);

	$effect(() => {
		if (!navigationSections.some(({ id }) => id === activeSectionId)) {
			activeSectionId = SPATIAL_ELEMENT_OVERVIEW_SECTION.id;
		}
	});
	$effect(() => {
		paneController?.setHidden(Boolean(stageContext?.isFullscreen?.()) || (stageContext?.getZoomFocus?.() ?? 0) >= 0.999);
	});
	function invokePaneAction() {
		mainElement.querySelector<HTMLElement>('[data-spatial-detail-pane-body] [data-catalog-rich-shared="primary-action"]')?.click();
	}

	function updateActiveSection() {
		if (navigationTargetId || !mainElement?.isConnected) return;
		const metrics = stageContext?.getLayoutMetrics?.('stable');
		const pane = metrics ? resolveDetailLayout(metrics).pane : undefined;
		const offset = pane?.body.y ?? (
			Number.parseFloat(
				getComputedStyle(mainElement).getPropertyValue('--spatial-element-section-scroll-offset')
			) || 24);
		const readingBottom = pane ? pane.body.y + pane.body.height : window.innerHeight;
		const bounds = sections.flatMap(section => {
			const rect = document.getElementById(section.id)?.getBoundingClientRect();
			return rect ? [{ id: section.id, top: rect.top, bottom: rect.bottom }] : [];
		});
		const scrollOwner = document.scrollingElement ?? document.documentElement;
		const nextActiveId = resolveActiveDetailSection(bounds, offset, readingBottom,
			getStageVisualScrollPosition().scrollY,
			Math.max(0, scrollOwner.scrollHeight - scrollOwner.clientHeight),
			SPATIAL_ELEMENT_OVERVIEW_SECTION.id);
		if (nextActiveId !== activeSectionId) activeSectionId = nextActiveId;
	}

	function handleSectionNavigation(sectionId: string) {
		if (!navigationSections.some(({ id }) => id === sectionId)) return;
		activeSectionId = sectionId;
		navigationTargetId = sectionId;
		mainElement.toggleAttribute('data-spatial-element-tab-navigation-active', true);
	}

	function completeSectionNavigation(sectionId: string) {
		if (navigationTargetId !== sectionId) return;
		navigationTargetId = undefined;
		mainElement.removeAttribute('data-spatial-element-tab-navigation-active');
		scheduleScrollSpy();
	}
	function scheduleScrollSpy() {
		cancelAnimationFrame(scrollSpyFrame);
		scrollSpyFrame = requestAnimationFrame(updateActiveSection);
	}

	onMount(() => {
		const unregisterMedia = stageContext?.registerDetailMedia?.(() => element ? selectedMedia.kind : 'minimap');
		paneController = new SpatialElementPaneController(mainElement,
			() => stageContext?.getLayoutMetrics?.('stable'), (split) => { splitPane = split; });
		paneController.start();
		const dock = new SpatialElementDockController(mainElement, () => stageContext?.getLayoutMetrics?.('stable'));
		dock.start();
		const unregisterPresentation = endpoints?.registerPresentation(
			{ brandId: brand.id, spatialElementId: spatialElement.id },
			() => dock.getPresentation().composition
		);
		const handleAnchorNavigation = (event: Event) => {
			handleSectionNavigation((event as CustomEvent<StageAnchorNavigationDetail>).detail.targetId);
		};
		const handleAnchorNavigationEnd = (event: Event) => {
			completeSectionNavigation(
				(event as CustomEvent<StageAnchorNavigationDetail>).detail.targetId
			);
		};
		window.addEventListener(STAGE_ANCHOR_NAVIGATION_EVENT, handleAnchorNavigation);
		window.addEventListener(STAGE_ANCHOR_NAVIGATION_END_EVENT, handleAnchorNavigationEnd);

		const stopScrollSpy = subscribeStageScrollFrame(
			updateActiveSection,
			STAGE_SCROLL_PRIORITY.dock + 1
		);
		const updateAfterResize = scheduleScrollSpy;
		window.addEventListener('resize', updateAfterResize, { passive: true });
		scheduleScrollSpy();

		return () => {
			unregisterMedia?.();
			paneController?.destroy();
			cancelAnimationFrame(scrollSpyFrame);
			window.removeEventListener(STAGE_ANCHOR_NAVIGATION_EVENT, handleAnchorNavigation);
			window.removeEventListener(STAGE_ANCHOR_NAVIGATION_END_EVENT, handleAnchorNavigationEnd);
			stopScrollSpy();
			window.removeEventListener('resize', updateAfterResize);
			dock.destroy();
			unregisterPresentation?.();
		};
	});
</script>

<svelte:head>
	<title>{spatialElement.pageTitle}</title>
</svelte:head>

<main
	bind:this={mainElement}
	class="spatial-element-main"
	data-spatial-element-root
	data-spatial-element-id={spatialElement.id}
	data-brand-id={spatialElement.brandId}
	data-spatial-selected-media={selectedMedia.kind}
	style:--spatial-pane-tint={paneTint}
	style:--spatial-pane-tint-opacity={`${Math.min(1, Math.max(0, brand.panelTheme.tintOpacity ?? 0.28)) * 100}%`}
	style:--spatial-pane-blur={`${Math.min(100, Math.max(0, brand.panelTheme.backdropBlur ?? 5))}px`}
>
	<div class="spatial-element-pane-heading" data-spatial-detail-pane-header data-spatial-detail-fixed>
		<SpatialElementBreadcrumbs items={spatialElement.breadcrumbs} />
		<div class="spatial-element-pane-title-row">
			<p class="spatial-element-pane-title">{spatialElement.title}</p>
			{#if spatialElement.eyebrow}<p class="spatial-element-pane-eyebrow">{spatialElement.eyebrow}</p>{/if}
			{#if spatialElement.action}
				<button type="button" class="spatial-element-pane-action" onclick={invokePaneAction}
					aria-label={spatialElement.action.ariaLabel ?? spatialElement.action.label}>
					<ShoppingCart size={24} aria-hidden="true" />
				</button>
			{/if}
		</div>
	</div>
	<SpatialElementStickyHeader {activeSectionId} {spatialElement} sections={navigationSections} />
	<div class="spatial-element-pane-surface" data-spatial-detail-pane-surface data-spatial-detail-fixed aria-hidden="true"></div>
	<div class="spatial-element-pane-cover spatial-element-pane-cover-top" data-spatial-detail-fixed aria-hidden="true"></div>
	<div class="spatial-element-pane-cover spatial-element-pane-cover-bottom" data-spatial-detail-fixed aria-hidden="true"></div>
	<div class="spatial-element-presentation">
	<section
		id={SPATIAL_ELEMENT_OVERVIEW_SECTION.id}
		class="spatial-element-hero"
		data-spatial-element-tab-target
		data-stage-scroll-top
		aria-labelledby="spatial-element-title"
		data-spatial-detail-media-region
		data-spatial-detail-fixed
	>
		<SpatialElementMediaRail {spatialElement} selectedId={selectedMedia.id} onselect={selectMedia} />

		<StageViewport
			catalogEndpoint={{
				brandId: brand.id,
				spatialElementId: spatialElement.id,
				slot: 'detail.hero',
				role: 'geometry'
			}}
			class="spatial-element-visual"
			data-catalog-geometry
			data-spatial-element-id={spatialElement.id}
			data-catalog-slot="detail.hero"
			fallbackSrc={selectedMedia.kind === 'minimap' ? spatialElement.fallbackImage : undefined}
			fallbackAlt={`${brand.name} ${spatialElement.title}`}
			aria-hidden={selectedMedia.kind === 'minimap' && !spatialElement.fallbackImage ? 'true' : undefined}
		>
			{#if selectedMedia.kind !== 'minimap'}
				{#key `${spatialElement.id}:${selectedMedia.id}`}<SpatialElementNativeMedia media={selectedMedia} />{/key}
			{/if}
		</StageViewport>

		{#key spatialElement.id}<SpatialElementHelp active={selectedMedia.kind === 'minimap'} />{/key}
	</section>
	<div class="spatial-element-pane-body" data-spatial-detail-pane-body data-stage-scroll-viewport>
		{#key spatialElement.id}<SpatialElementSummaryPanel {spatialElement} nativeContent={splitPane} />{/key}
	<div class="spatial-element-content">
		<div class="spatial-element-section-list spatial-content-width spatial-content-container" data-catalog-transition-dom="enter">
			<SectionSurfaceGroup>{@render children?.()}</SectionSurfaceGroup>
		</div>
		<!-- Read after the section snippet has registered its metadata during SSR. -->
		<SpatialElementTabs {activeSectionId} sections={[SPATIAL_ELEMENT_OVERVIEW_SECTION, ...sections]} />
	</div>
	</div>
	</div>
	<div class="spatial-element-pane-submenu-shell" data-spatial-detail-pane-submenu-shell data-spatial-detail-fixed>
		<div class="spatial-element-pane-submenu" data-spatial-detail-pane-submenu aria-hidden="true" inert></div>
	</div>
</main>

<style>
	.spatial-element-main {
		--spatial-element-section-scroll-offset: 150px;
		width: 100%;
		margin: 0;
	}
	.spatial-element-presentation { position: relative; }
	.spatial-element-pane-heading { display: contents; }
	.spatial-element-pane-title-row, .spatial-element-pane-surface,
	.spatial-element-pane-cover, .spatial-element-pane-submenu-shell { display: none; }

	.spatial-element-hero {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.spatial-element-content {
		display: flex;
		flex-direction: column;
		width: 100%;
	}

	.spatial-element-section-list {
		order: 2;
		margin-top: var(--spatial-detail-submenu-after-gap, 0px);
	}

	.spatial-element-content :global(.spatial-element-tabs-anchor) {
		order: 1;
	}

	.spatial-element-section-list :global(.content-section:first-child) {
		margin-top: 0;
	}

	.spatial-element-hero :global(.spatial-element-visual) {
		order: -1;
		flex: none;
		margin-left: var(--spatial-detail-fit-left);
		width: calc(100% - var(--spatial-detail-fit-left) - var(--spatial-detail-fit-right));
		height: var(--spatial-detail-fit-height);
		min-height: 0;
		background: transparent;
		pointer-events: none;
	}
	@media (min-width: 840px) {
		.spatial-element-hero { height: var(--spatial-detail-fit-height); }
		.spatial-element-content { padding-top: 8px; }
		.spatial-element-content :global(.spatial-element-tabs-anchor) { margin-left: 8px; max-width: calc(100% - 16px); }
	}
	@media (min-width: 1200px) {
		.spatial-element-content :global(.spatial-element-tabs-anchor) { max-width: calc(100% - 32px); }
	}
	@media (min-width: 1600px) {
		.spatial-element-content { padding-top: 12px; }
		.spatial-element-content :global(.spatial-element-tabs-anchor) { margin-left: calc((100% - var(--spatial-detail-content-width)) / 2); max-width: var(--spatial-detail-content-width); }
	}
</style>
