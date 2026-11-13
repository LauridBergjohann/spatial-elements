<script lang="ts">
	import { ContentPage, SpatialCarouselSection } from '@spatial-elements/sveltekit';
	import { HeadingSection, CardGridSection } from '@page-sections/svelte';
	import { showcaseSegments } from '$lib/showcase/segments';
	import { showcaseProducts } from '$lib/showcase/products';
	import { featuredItems } from '$lib/showcase/collection';
	import { showcaseHdr } from '$lib/showcase/optimized';
	const areas = showcaseSegments.map((segment) => {
		const product = showcaseProducts.find((product) => product.segment.id === segment.id)!;
		return {
			id: segment.id,
			title: segment.title,
			description: segment.description,
			href: '/showcase/' + segment.id + '/',
			image: {
				src: '/assets/showcase/' + product.id + '/' + product.id + '-poster.webp',
				alt: segment.title + ' collection',
				width: 1024,
				height: 1024
			}
		};
	});
</script>

<ContentPage page={{ title: 'Showcase', breadcrumbs: [] }} hdr={showcaseHdr}>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Showcase',
			headingLevel: 1,
			introduction:
				'Explore spatial experiences for everyday technology, tools, industry and luxury. These collections are demonstrations, not shops.'
		}}
	/>
	<CardGridSection
		section={{ id: 'areas', title: 'Explore the collections', headline: 'Explore the collections' }}
		list={areas}
		cardSize="m"
		cardTone="standard"
		mediaAspect="3/2"
	/>
	<SpatialCarouselSection
		section={{
			id: 'featured-products',
			title: 'Selected products',
			headline: 'Selected products',
			background: { color: 'transparent', size: 'full' }
		}}
		list={featuredItems}
	/>
</ContentPage>
