<script lang="ts">
	import ContentPage from './ContentPage.svelte';
	import ListSection from './ListSection.svelte';
	import Section from './Section.svelte';
	import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
	import type { SpatialListItem, ContentPageData } from '@spatial-elements/core/spatial-element/types';
	let {
		spatialElements,
		sectionLink,
		...page
	}: ContentPageData & {
		spatialElements: SpatialListItem[];
		sectionLink?: { href: string; label: string };
	} = $props();
	const { href } = useCatalogNavigation();
</script>

<ContentPage {page}>
	<ListSection section={{ id: 'elements', title: 'Elements' }} list={spatialElements} />
	{#if sectionLink}<Section section={{ id: 'more', title: 'More information' }}
			><a href={href(sectionLink.href)}>{sectionLink.label}</a></Section
		>{/if}
</ContentPage>
