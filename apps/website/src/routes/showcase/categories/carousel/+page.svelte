<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { showcaseElements as elements } from '$lib/showcase/collection';
	const items = getSpatialListItems(elements, '/showcase/elements');
</script>

<ContentPage
	hdr="/assets/lobe.hdr"
	page={{
		title: 'Showcase · carousel',
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: 'carousel' }]
	}}
>
	<HeadingSection
		section={{
			id: 'catalog',
			title: 'Showcase',
			headingLevel: 1,
			eyebrow: 'Interactive demonstration · Not a shop'
		}}
	/>
	<Section section={{ id: 'views', title: 'Collection views' }}
		><nav aria-label="Collection views">
			<a href="/showcase/categories/list/">Grid</a> ·
			<a href="/showcase/categories/carousel/">Carousel</a>
			· <a href="/showcase/categories/mixed/">Mixed</a>
		</nav></Section
	>

	<SpatialCarouselSection
		section={{
			id: 'carousel',
			title: 'Explore in space',
			headline: 'Explore in space',
			background: { color: 'transparent', size: 'full' }
		}}
		list={items}
	/>
</ContentPage>
