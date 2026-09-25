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
	import ProductBreadcrumbs from './ProductBreadcrumbs.svelte';
	import { useProductBrand } from './brandContext.js';
	import ProductMediaRail from './ProductMediaRail.svelte';
	import ProductSummaryPanel from './ProductSummaryPanel.svelte';
	import ProductStickyHeader from './ProductStickyHeader.svelte';
	import ProductTabs from './ProductTabs.svelte';
	import { ProductDockController } from '@spatial-elements/core/product-detail/ProductDockController';
	import { PRODUCT_SECTION_REGISTRY_KEY, ProductSectionRegistry } from '@spatial-elements/core/product-detail/productSectionRegistry';
	import type { ProductDetailData, ProductSectionNavigationItem } from '@spatial-elements/core/product-detail/types';

	const PRODUCT_OVERVIEW_SECTION = {
		id: 'overview',
		title: 'Übersicht'
	} satisfies ProductSectionNavigationItem;
	// Switch while the next panel enters the upper reading area, before it reaches the sticky tabs.
	const PRODUCT_SECTION_ACTIVATION_VIEWPORT_RATIO = 0.25;

	let { product, children }: { product: ProductDetailData; children?: Snippet } = $props();
	const brand = useProductBrand();
	const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	let sections = $state<ProductSectionNavigationItem[]>([]);
	let activeSectionId = $state<string | undefined>(PRODUCT_OVERVIEW_SECTION.id);
	let mainElement: HTMLElement;
	let navigationTargetId: string | undefined;
	let scrollSpyFrame = 0;
	const navigationSections = $derived([PRODUCT_OVERVIEW_SECTION, ...sections]);

	const sectionRegistry = new ProductSectionRegistry((nextSections) => {
		sections = nextSections;
	});
	setContext(PRODUCT_SECTION_REGISTRY_KEY, sectionRegistry);

	$effect(() => {
		if (!navigationSections.some(({ id }) => id === activeSectionId)) {
			activeSectionId = PRODUCT_OVERVIEW_SECTION.id;
		}
	});

	function updateActiveSection() {
		if (navigationTargetId || !mainElement?.isConnected) return;
		const offset =
			Number.parseFloat(
				getComputedStyle(mainElement).getPropertyValue('--product-section-scroll-offset')
			) || 24;
		const readingAreaHeight = Math.max(window.innerHeight - offset, 0);
		const activationLine = offset + readingAreaHeight * PRODUCT_SECTION_ACTIVATION_VIEWPORT_RATIO;
		let nextActiveId = PRODUCT_OVERVIEW_SECTION.id;

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
		mainElement.toggleAttribute('data-product-tab-navigation-active', true);
	}

	function completeSectionNavigation(sectionId: string) {
		if (navigationTargetId !== sectionId) return;
		navigationTargetId = undefined;
		mainElement.removeAttribute('data-product-tab-navigation-active');
		scheduleScrollSpy();
	}
	function scheduleScrollSpy() {
		cancelAnimationFrame(scrollSpyFrame);
		scrollSpyFrame = requestAnimationFrame(updateActiveSection);
	}

	onMount(() => {
		const dock = new ProductDockController(mainElement);
		dock.start();
		const unregisterPresentation = endpoints?.registerPresentation(
			{ brandId: brand.id, productId: product.id },
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
	<title>{product.pageTitle}</title>
</svelte:head>

<main
	bind:this={mainElement}
	class="product-main"
	data-product-detail-root
	data-product-id={product.id}
	data-brand-id={product.brandId}
>
	<ProductBreadcrumbs
		items={product.breadcrumbs.map((item) => ({
			...item,
			href: item.href ?? `/${brand.id}/categories/list`
		}))}
	/>
	<ProductStickyHeader {activeSectionId} {product} sections={navigationSections} />

	<section
		id={PRODUCT_OVERVIEW_SECTION.id}
		class="product-hero"
		data-product-tab-target
		data-stage-scroll-top
		aria-labelledby="product-title"
	>
		<ProductMediaRail {product} />

		<StageViewport
			catalogEndpoint={{
				brandId: brand.id,
				productId: product.id,
				slot: 'pdp.hero',
				role: 'geometry'
			}}
			class="product-visual"
			data-catalog-geometry
			data-product-id={product.id}
			data-catalog-slot="pdp.hero"
			fallbackSrc={product.stage.fallbackImage}
			fallbackAlt={`${brand.name} ${product.title}`}
			aria-hidden={product.stage.fallbackImage ? undefined : 'true'}
		/>

		<ProductSummaryPanel {product} />
	</section>

	<div class="product-content">
		<div class="product-section-list" data-catalog-transition-dom="enter">
			{@render children?.()}
		</div>
		<!-- Read after the section snippet has registered its metadata during SSR. -->
		<ProductTabs {activeSectionId} sections={[PRODUCT_OVERVIEW_SECTION, ...sections]} />
	</div>
</main>

<style>
	.product-main {
		--product-section-scroll-offset: 150px;
		--product-hero-edge-gap: clamp(32px, 2.2vw, 42px);

		width: min(1550px, calc(100vw - 120px), 100%);
		margin: 0 auto;
	}

	.product-hero {
		position: relative;
		box-sizing: border-box;
		display: grid;
		grid-template-columns: minmax(420px, 1fr) minmax(360px, 494px);
		gap: clamp(28px, 4vw, 70px);
		align-items: start;
		width: calc(100vw - var(--product-hero-edge-gap) - var(--product-hero-edge-gap));
		min-height: clamp(610px, calc(100vh - 230px), 760px);
		margin-left: calc(50% - 50vw + var(--product-hero-edge-gap));
		padding-left: max(0px, calc(50vw - 50% - var(--product-hero-edge-gap)));
	}

	.product-content {
		display: flex;
		flex-direction: column;
		width: calc(100vw - var(--product-content-inline-inset) - var(--product-content-inline-inset));
		margin-left: calc(50% - 50vw + var(--product-content-inline-inset));
	}

	.product-section-list {
		order: 2;
	}

	.product-content :global(.product-tabs-anchor) {
		order: 1;
	}

	.product-section-list :global(.content-section:first-child) {
		margin-top: 8px;
	}

	:global(.product-visual) {
		min-height: clamp(540px, calc(100vh - 300px), 680px);
		border-radius: 28px;
		background: transparent;
		pointer-events: none;
	}

	@media (max-width: 1100px) {
		.product-main {
			width: min(calc(100vw - 40px), 100%);
		}

		.product-content {
			width: 100%;
			margin-left: 0;
		}

		.product-hero {
			grid-template-columns: 1fr;
			width: 100%;
			margin-left: 0;
			padding-left: 0;
		}
	}
</style>
