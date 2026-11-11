<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { watchesSpatialElements as elements } from '$lib/showcase/watches';
	const items = getSpatialListItems(elements, '/showcase/watches/elements');
</script>

<ContentPage
	hdr="/assets/lobe.hdr"
	page={{
		title: 'The watch · list',
		breadcrumbs: [
			{ label: 'Showcase', href: '/showcase/' },
			{ label: 'The watch', href: '/showcase/watches/' },
			{ label: 'list' }
		]
	}}
>
	<HeadingSection
		section={{
			id: 'catalog',
			title: 'The watch',
			headingLevel: 1,
			eyebrow: 'Interactive demonstration · Not a shop'
		}}
	/>
	<Section section={{ id: 'views', title: 'Collection views' }}
		><nav aria-label="Collection views">
			<a href="/showcase/watches/categories/list/">Grid</a> ·
			<a href="/showcase/watches/categories/carousel/">Carousel</a>
			· <a href="/showcase/watches/categories/mixed/">Mixed</a>
		</nav></Section
	>
	<SpatialCardGridSection
		section={{
			id: 'collection',
			title: 'Collection',
			headline: 'Collection',
			background: { color: 'standard', size: 'standard' }
		}}
		list={items}
		cardTone="muted"
		cardSize="m"
		mediaAspect="3/2"
	/>
</ContentPage>
