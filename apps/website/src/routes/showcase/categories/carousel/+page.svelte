<script lang="ts">
	import {
		ContentPage,
		SpatialCarouselSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { showcaseElements as elements } from '$lib/showcase/collection';
	import { showcaseHdr } from '$lib/showcase/optimized';
	const items = getSpatialListItems(elements, '/showcase/elements');
</script>

<ContentPage
	hdr={showcaseHdr}
	page={{
		title: 'Showcase · Carousel',
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: 'Carousel' }]
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
