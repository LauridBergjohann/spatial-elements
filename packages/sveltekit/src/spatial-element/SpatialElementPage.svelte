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
	import SpatialElementStickyHeader from './SpatialElementStickyHeader.svelte';
	import SpatialElementTabs from './SpatialElementTabs.svelte';
	import { SpatialElementDockController } from '@spatial-elements/core/spatial-element/SpatialElementDockController';
	import { SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, SpatialElementSectionRegistry } from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	import type { SpatialElementData, SpatialElementSectionNavigationItem } from '@spatial-elements/core/spatial-element/types';

	const SPATIAL_ELEMENT_OVERVIEW_SECTION = {
		id: 'overview',
		title: 'Übersicht'
	} satisfies SpatialElementSectionNavigationItem;
	// Switch while the next panel enters the upper reading area, before it reaches the sticky tabs.
	const SPATIAL_ELEMENT_SECTION_ACTIVATION_VIEWPORT_RATIO = 0.25;

	let { spatialElement, children }: { spatialElement: SpatialElementData; children?: Snippet } = $props();
	const brand = useSpatialTheme();
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
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
		const dock = new SpatialElementDockController(mainElement);
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
		items={spatialElement.breadcrumbs.map((item) => ({
			...item,
			href: item.href ?? `/${brand.id}/categories/list`
		}))}
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
			fallbackSrc={spatialElement.stage.fallbackImage}
			fallbackAlt={`${brand.name} ${spatialElement.title}`}
			aria-hidden={spatialElement.stage.fallbackImage ? undefined : 'true'}
		/>

		<SpatialElementSummaryPanel {spatialElement} />
	</section>

	<div class="spatial-element-content">
		<div class="spatial-element-section-list" data-catalog-transition-dom="enter">
			{@render children?.()}
		</div>
		<!-- Read after the section snippet has registered its metadata during SSR. -->
		<SpatialElementTabs {activeSectionId} sections={[SPATIAL_ELEMENT_OVERVIEW_SECTION, ...sections]} />
	</div>
</main>

<style>
	.spatial-element-main {
		--spatial-element-section-scroll-offset: 150px;
		--spatial-element-hero-edge-gap: clamp(32px, 2.2vw, 42px);

		width: min(1550px, calc(100vw - 120px), 100%);
		margin: 0 auto;
	}

	.spatial-element-hero {
		position: relative;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(420px, 1fr) minmax(360px, 494px);
		gap: clamp(28px, 4vw, 70px);
		align-items: start;
		width: calc(100vw - var(--spatial-element-hero-edge-gap) - var(--spatial-element-hero-edge-gap));
		min-height: clamp(610px, calc(100vh - 230px), 760px);
		margin-left: calc(50% - 50vw + var(--spatial-element-hero-edge-gap));
		padding-left: max(0px, calc(50vw - 50% - var(--spatial-element-hero-edge-gap)));
	}

	.spatial-element-content {
		display: flex;
		flex-direction: column;
		width: calc(100vw - var(--spatial-element-content-inline-inset) - var(--spatial-element-content-inline-inset));
		margin-left: calc(50% - 50vw + var(--spatial-element-content-inline-inset));
	}

	.spatial-element-section-list {
		order: 2;
	}

	.spatial-element-content :global(.spatial-element-tabs-anchor) {
		order: 1;
	}

	.spatial-element-section-list :global(.content-section:first-child) {
		margin-top: 8px;
	}

	:global(.spatial-element-visual) {
		min-height: clamp(540px, calc(100vh - 300px), 680px);
		border-radius: 28px;
		background: transparent;
		pointer-events: none;
	}

	@media (max-width: 1100px) {
		.spatial-element-main {
			width: min(calc(100vw - 40px), 100%);
		}

		.spatial-element-content {
			width: 100%;
			margin-left: 0;
		}

		.spatial-element-hero {
			grid-template-columns: 1fr;
			width: 100%;
			margin-left: 0;
			padding-left: 0;
		}
	}
</style>
