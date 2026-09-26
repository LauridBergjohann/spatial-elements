<script lang="ts">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ContentPageData } from '@spatial-elements/core/spatial-element/types';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import {
		SPATIAL_ELEMENT_SECTION_REGISTRY_KEY,
		SpatialElementSectionRegistry,
		SECTION_PAGE_KIND
	} from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
	let { page, children }: { page: ContentPageData; children?: Snippet } = $props();
	const brand = useSpatialTheme();
	setContext(SPATIAL_ELEMENT_SECTION_REGISTRY_KEY, new SpatialElementSectionRegistry());
	setContext(SECTION_PAGE_KIND, 'content');
</script>

<svelte:head><title>{page.pageTitle ?? page.title}</title></svelte:head>
<main class="content-page" data-catalog-list data-brand-id={brand.id}>
	{#if page.breadcrumbs?.length}<SpatialElementBreadcrumbs
			items={page.breadcrumbs}
			transition="exit"
		/>{/if}
	<header data-stage-dom-content data-catalog-transition-dom="exit">
		{#if page.eyebrow}<p class="eyebrow">{page.eyebrow}</p>{/if}
		<h1 id="catalog-title" tabindex="-1">{page.title}</h1>
		{#if page.intro}<p class="intro">{page.intro}</p>{/if}
	</header>
	{@render children?.()}
</main>

<style>
	.content-page {
		width: min(1500px, calc(100vw - 120px));
		margin: 0 auto;
		padding-bottom: 120px;
	}
	header {
		max-width: 780px;
		padding: 12px 0 32px;
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
		margin: 10px 0 14px;
		color: var(--spatial-element-ink);
		font-size: clamp(30px, 3.4vw, 46px);
		line-height: 1.1;
	}
	.intro {
		max-width: 64ch;
		margin: 0;
		color: var(--spatial-element-body);
		font-size: 17px;
		line-height: 1.6;
	}
	@media (max-width: 900px) {
		.content-page {
			width: calc(100vw - 40px);
		}
	}
</style>
