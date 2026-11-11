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
<HeadingSection section={{ id: 'catalog', title: 'A study of form', eyebrow: 'SPATIAL ELEMENTS', headingLevel: 1 }} />

	<Section
		section={{
			id: 'introduction',
			title: 'Objects with room to explore',
			headline: 'Objects with room to explore',
			background: { color: 'standard' }
		}}
		><p>
			A collection of original geometric forms. Move between the list, carousel and detail views.
		</p>
		<a href="/demo/elements/orb#features">Explore the orb features</a></Section
	>
	<SpatialCardGridSection
		section={{
			id: 'elements',
			title: 'Collection',
			headline: 'Collection',
			background: { color: 'standard' }
		}}
        cardSize='m'
		list={data.spatialElements}
	/>
	<Section
		section={{
			id: 'story',
			title: 'Shape, light and movement',
			headline: 'Shape, light and movement',
			background: { color: 'standard' }
		}}
		><img src="/assets/demo/ring.svg" alt="Green ring study" width="320" height="280" />
		<p>
			Compose your own text, images and interactive collections in a single content page.
		</p></Section
	><SpatialCarouselSection
		section={{
			id: 'featured',
			title: 'Forms in space',
			headline: 'Forms in space',
			background: { color: 'transparent', size: 'full' }
		}}
		list={data.spatialElements}
	/>
</ContentPage>
