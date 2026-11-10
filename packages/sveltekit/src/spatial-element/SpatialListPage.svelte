<script lang="ts">
	import type { SpatialCardGridOptions } from './spatialCardGrid.js';
	import ContentPage from './ContentPage.svelte';
	import SpatialCardGridSection from './SpatialCardGridSection.svelte';
	import Section from './Section.svelte';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	import type {
		SpatialListItem,
		ContentPageData
	} from '@spatial-elements/core/spatial-element/types';
	let {
		spatialElements,
		hdr,
		sectionLink,
		cardSize,
		cardVariant,
		itemSpan,
		textAlign,
		mediaAspect,
		mediaFit,
		cardTone,
		...page
	}: ContentPageData &
		SpatialCardGridOptions & {
			/** Explicit environment for the collection. */
			hdr: string;
			spatialElements: SpatialListItem[];
			sectionLink?: { href: string; label: string };
		} = $props();
	const { href } = useCatalogNavigation();
</script>

<ContentPage {page} {hdr}>
	<SpatialCardGridSection
		section={{ id: 'elements', title: 'Elements' }}
		list={spatialElements}
		{cardSize}
		{cardVariant}
		{itemSpan}
		{textAlign}
		{mediaAspect}
		{mediaFit}
		{cardTone}
	/>
	{#if sectionLink}<Section section={{ id: 'more', title: 'More information' }}
			><a href={href(sectionLink.href)}>{sectionLink.label}</a></Section
		>{/if}
</ContentPage>
