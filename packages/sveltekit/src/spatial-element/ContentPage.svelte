<script lang="ts">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ContentPageData } from '@spatial-elements/core/spatial-element/types';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import { registerSpatialPage } from './spatialPageContext.js';
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
		/** ListSection, CarouselSection and ordinary Section children. */
		children?: Snippet;
	}
	let { page, hdr, children }: Props = $props();
	const readTheme = useSpatialTheme();
	const brand = $derived(readTheme());
	registerSpatialPage(() => ({ kind: 'content', hdr }));
	setContext(SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, new SpatialElementSectionRegistry());
	setContext(SECTION_PAGE_KIND, 'content');
</script>

<svelte:head><title>{page.pageTitle ?? page.title}</title></svelte:head>
<main class="content-page spatial-content-width spatial-content-container" data-catalog-list data-brand-id={brand.id}>
	{#if page.breadcrumbs?.length}<SpatialElementBreadcrumbs
			items={page.breadcrumbs}
			transition="exit"
		/>{/if}
	<header class="spatial-grid-scope" data-stage-dom-content data-catalog-transition-dom="exit">
		{#if page.eyebrow}<p class="eyebrow">{page.eyebrow}</p>{/if}
		<h1 id="catalog-title" tabindex="-1">{page.title}</h1>
		{#if page.intro}<p class="intro">{page.intro}</p>{/if}
	</header>
	{@render children?.()}
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
