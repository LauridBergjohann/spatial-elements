<script lang="ts">
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
	<SpatialCarouselSection
		section={{ id: 'featured', title: 'Forms in space', headline: 'Forms in space' }}
		list={data.spatialElements}
	/>
</ContentPage>
