<script lang="ts">
	import { HeadingSection } from '@page-sections/svelte';

	import {
		ContentPage,
		Section,
		SpatialCardGridSection,
		SpatialCarouselSection
	} from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage
	hdr="/assets/demo/studio.hdr"
	page={{
		title: 'A study of form',
		eyebrow: 'SPATIAL ELEMENTS',
		breadcrumbs: [{ label: 'Collection', href: '/demo/categories/list' }]
	}}
>
	<HeadingSection
		section={{
			id: 'catalog',
			title: 'A study of form',
			eyebrow: 'SPATIAL ELEMENTS',
			headingLevel: 1
		}}
	/>

	<SpatialCarouselSection
		section={{ id: 'featured', title: 'Forms in space', headline: 'Forms in space' }}
		list={data.spatialElements}
	/>
</ContentPage>
