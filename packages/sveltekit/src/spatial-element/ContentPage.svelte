<script lang="ts">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ContentPageData } from '@spatial-elements/core/spatial-element/types';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import { registerSpatialPage } from './spatialPageContext.js';
	import SectionSurfaceGroup from './SectionSurfaceGroup.svelte';
	import './layout.generated.css';
	import {
		SPATIAL_ELEMENT_SECTION_REGISTRY_KEY,
		SpatialElementSectionRegistry,
		SECTION_PAGE_KIND
	} from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	interface Props {
		/** Explicit HDR used to light this page's shared 3D scene; never inferred from an element. */
		hdr: string;
		/** Category metadata. Only title is required; pageTitle defaults to title. */
		page: ContentPageData;
		/** Flat page color override, using the same color format as SpatialTheme.background. */
		background?: string;
		/** ListSection, CarouselSection and ordinary Section children. */
		children?: Snippet;
	}
	let { page, hdr, background, children }: Props = $props();
	const backgroundId = $props.id();
	const backgroundScope = backgroundId.replace(/[^a-zA-Z0-9_-]/g, '_');
	const backgroundRules = $derived.by(() => {
		if (!background) return '';
		if (/[;{}<>]/.test(background)) throw new Error('ContentPage.background must be a color value.');
		// A child page cannot inherit a custom property upwards. This page-scoped rule
		// supplies the native SSR surface before the browser registers GPU ownership.
		return `.stage:has([data-spatial-page-background="${backgroundScope}"]) { --stage-page-background: ${background} !important; }`;
	});
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	registerSpatialPage(() => ({ kind: 'content', hdr, background }));
	setContext(SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, new SpatialElementSectionRegistry());
	setContext(SECTION_PAGE_KIND, 'content');
</script>

<svelte:head><title>{page.pageTitle ?? page.title}</title></svelte:head>
<main class="content-page spatial-content-width spatial-content-container" data-catalog-list data-brand-id={brand.id}
	data-spatial-page-background={background ? backgroundScope : undefined}>
	{#if background}<svelte:element this={'style'}>{backgroundRules}</svelte:element>{/if}
	{#if page.breadcrumbs?.length}<SpatialElementBreadcrumbs
			items={page.breadcrumbs}
			transition="exit"
		/>{/if}
	<header class="spatial-grid-scope" data-stage-dom-content data-catalog-transition-dom="exit">
		{#if page.eyebrow}<p class="eyebrow">{page.eyebrow}</p>{/if}
		<h1 id="catalog-title" tabindex="-1">{page.title}</h1>
		{#if page.intro}<p class="intro">{page.intro}</p>{/if}
	</header>
	<SectionSurfaceGroup>{@render children?.()}</SectionSurfaceGroup>
</main>

<style>
	.content-page {
		padding-bottom: 120px;
	}
	header {
		padding: var(--spatial-grid-gap);
		pointer-events: auto;
	}
	.eyebrow {
		margin: 0;
		color: var(--spatial-element-accent);
		font-size: 13px;
		font-weight: 720;
		text-transform: uppercase;
	}
	h1 {
		margin: 0;
		color: var(--spatial-element-ink);
		font-size: var(--spatial-grid-headline-size);
		font-weight: 600;
		line-height: var(--spatial-grid-headline-line-height);
	}
	.intro {
		max-width: 64ch;
		margin: var(--spatial-grid-headline-gap) 0 0;
		color: var(--spatial-element-body);
		font-size: var(--spatial-grid-body-size);
		line-height: var(--spatial-grid-body-line-height);
	}
</style>
