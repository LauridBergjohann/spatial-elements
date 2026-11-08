<script lang="ts">
	import { setContext } from 'svelte';
	import { ContentPage as PageContent, Section as PageSection } from '@page-sections/svelte';
	import type { Snippet } from 'svelte';
	import type { ContentPageData } from '@spatial-elements/core/spatial-element/types';
	import { useSpatialTheme } from './brandContext.js';
	import SpatialElementBreadcrumbs from './SpatialElementBreadcrumbs.svelte';
	import { registerSpatialPage } from './spatialPageContext.js';
	import './layout.generated.css';
	import {
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
	setContext(SECTION_PAGE_KIND, 'content');
</script>

{#if background}<svelte:element this={'style'}>{backgroundRules}</svelte:element>{/if}
<PageContent {page} class="content-page" aria-labelledby="catalog-title" data-catalog-list data-brand-id={brand.id}
 data-spatial-page-background={background ? backgroundScope : undefined}>
 {#snippet header()}
  {#if page.breadcrumbs?.length}<SpatialElementBreadcrumbs items={page.breadcrumbs} transition="exit" />{/if}
  <PageSection section={{ id: 'catalog', title: page.title, headline: page.title, eyebrow: page.eyebrow, introduction: page.intro, headingLevel: 1 }} data-stage-dom-content data-catalog-transition-dom="exit" />
 {/snippet}
 {@render children?.()}
</PageContent>
