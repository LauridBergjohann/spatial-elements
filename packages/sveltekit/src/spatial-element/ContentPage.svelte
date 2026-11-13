<script lang="ts">
	import { setContext, onMount } from 'svelte';
	import { attachContentSidebars } from './contentSidebars.js';
	import { ContentPage as PageContent } from '@page-sections/svelte';
	import type { Snippet } from 'svelte';
	import type { ContentPageData } from '@spatial-elements/core/spatial-element/types';
	import { useSpatialTheme } from './brandContext.js';
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
		/** SpatialCardGridSection, SpatialCarouselSection and ordinary Section children. */
		children?: Snippet;
		leftSidebar?: Snippet;
		footer?: Snippet;
		showContentMenu?: boolean;
		contentMenuLabel?: string;
	}
	let { page, hdr, background, children, leftSidebar, footer, showContentMenu = false, contentMenuLabel }: Props = $props();
	const backgroundId = $props.id();
	const backgroundScope = backgroundId.replace(/[^a-zA-Z0-9_-]/g, '_');
	onMount(() => {
		const host = document.querySelector<HTMLElement>(`[data-spatial-content-page="${backgroundScope}"]`);
		if (host) return attachContentSidebars(host);
	});
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
<PageContent {page} {leftSidebar} {footer} {showContentMenu} {contentMenuLabel} class="content-page" data-catalog-list data-brand-id={brand.id}
 data-spatial-content-page={backgroundScope} data-spatial-page-background={background ? backgroundScope : undefined}>
 {@render children?.()}
</PageContent>

<style>
 :global(.content-page [data-spatial-sticky-sidebar]) { position: relative !important; top: 0 !important; }
 /* The shared stage leaves its DOM layer transparent to model interaction.
  * Ordinary Page Sections and navigation still need native hit targets. */
 :global(.content-page .ps-section),
 :global(.content-page .ps-left-sidebar),
 :global(.content-page .ps-content-menu-slot),
 :global(.content-page .breadcrumbs),
 :global(.content-page nav) {
  pointer-events: auto;
 }
</style>
