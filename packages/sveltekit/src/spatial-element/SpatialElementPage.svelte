<script lang="ts">
	import { getContext, onMount, setContext } from 'svelte';
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
	import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementMediaRail from './SpatialElementMediaRail.svelte';
	import SpatialElementSummaryPanel from './SpatialElementSummaryPanel.svelte';
	import SpatialElementHelp from './SpatialElementHelp.svelte';
	import SpatialElementStickyHeader from './SpatialElementStickyHeader.svelte';
	import SpatialElementTabs from './SpatialElementTabs.svelte';
	import SectionSurfaceGroup from './SectionSurfaceGroup.svelte';
	import './layout.generated.css';
	import { SpatialElementDockController } from '@spatial-elements/core/spatial-element/SpatialElementDockController';
	import { SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, SpatialElementSectionRegistry } from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	import type { SpatialElementData, SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';
	import { resolveSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import { registerSpatialPage } from './spatialPageContext.js';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';

	const SPATIAL_ELEMENT_OVERVIEW_SECTION = {
		id: 'overview',
		title: 'Übersicht'
	} satisfies SpatialElementSectionNavigationItem;
	// Switch while the next panel enters the upper reading area, before it reaches the sticky tabs.
	const SPATIAL_ELEMENT_SECTION_ACTIVATION_VIEWPORT_RATIO = 0.25;

	interface Props {
		/** Complete element document from this page's load function. Registers assets with the enclosing shell. */
		spatialElement: SpatialElementData;
		/** Detail sections; Section components automatically populate the tab navigation. */
		children?: Snippet;
	}
	let { spatialElement: element, children }: Props = $props();
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	const spatialElement = $derived(resolveSpatialElementData(element, brand.id));
	// During route teardown Kit can clear the outgoing page's data before unmount.
	// Read raw assets here, so the parent stage never evaluates outgoing DOM-derived content.
	registerSpatialPage(() => element ? { kind: 'detail', element } : { kind: 'content', hdr: '' });
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	const stageContext = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	let sections = $state<SpatialElementSectionNavigationItem[]>([]);
	let activeSectionId = $state<string | undefined>(SPATIAL_ELEMENT_OVERVIEW_SECTION.id);
	let mainElement: HTMLElement;
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

	function updateActiveSection() {
		if (navigationTargetId || !mainElement?.isConnected) return;
		const offset =
			Number.parseFloat(
				getComputedStyle(mainElement).getPropertyValue('--spatial-element-section-scroll-offset')
			) || 24;
		const readingAreaHeight = Math.max(window.innerHeight - offset, 0);
		const activationLine = offset + readingAreaHeight * SPATIAL_ELEMENT_SECTION_ACTIVATION_VIEWPORT_RATIO;
		let nextActiveId = SPATIAL_ELEMENT_OVERVIEW_SECTION.id;

		for (const section of sections) {
			const element = document.getElementById(section.id);
			if (!element || element.getBoundingClientRect().top > activationLine + 1) break;
			nextActiveId = section.id;
		}

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
>
	<SpatialElementBreadcrumbs
		items={spatialElement.breadcrumbs}
	/>
	<SpatialElementStickyHeader {activeSectionId} {spatialElement} sections={navigationSections} />

	<section
		id={SPATIAL_ELEMENT_OVERVIEW_SECTION.id}
		class="spatial-element-hero"
		data-spatial-element-tab-target
		data-stage-scroll-top
		aria-labelledby="spatial-element-title"
	>
		<SpatialElementMediaRail {spatialElement} />

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
			fallbackSrc={spatialElement.fallbackImage}
			fallbackAlt={`${brand.name} ${spatialElement.title}`}
			aria-hidden={spatialElement.fallbackImage ? undefined : 'true'}
		/>

		{#key spatialElement.id}<SpatialElementHelp />{/key}
		{#key spatialElement.id}<SpatialElementSummaryPanel {spatialElement} />{/key}
	</section>

	<div class="spatial-element-content">
		<div class="spatial-element-section-list spatial-content-width spatial-content-container" data-catalog-transition-dom="enter">
			<SectionSurfaceGroup>{@render children?.()}</SectionSurfaceGroup>
		</div>
		<!-- Read after the section snippet has registered its metadata during SSR. -->
		<SpatialElementTabs {activeSectionId} sections={[SPATIAL_ELEMENT_OVERVIEW_SECTION, ...sections]} />
	</div>
</main>

<style>
	.spatial-element-main {
		--spatial-element-section-scroll-offset: 150px;
		width: 100%;
		margin: 0;
	}

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
