<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { weraSpatialElements as elements } from '$lib/showcase/wera';
	const items = getSpatialListItems(elements, '/showcase/wera/elements');
</script>

<ContentPage
	hdr="/assets/lobe.hdr"
	page={{
		title: 'Wera tools · carousel',
		breadcrumbs: [
			{ label: 'Showcase', href: '/showcase/' },
			{ label: 'Wera tools', href: '/showcase/wera/' },
			{ label: 'carousel' }
		]
	}}
>
	<HeadingSection
		section={{
			id: 'catalog',
			title: 'Wera tools',
			headingLevel: 1,
			eyebrow: 'Interactive demonstration · Not a shop'
		}}
	/>
	<Section section={{ id: 'views', title: 'Collection views' }}
		><nav aria-label="Collection views">
			<a href="/showcase/wera/categories/list/">Grid</a> ·
			<a href="/showcase/wera/categories/carousel/">Carousel</a>
			· <a href="/showcase/wera/categories/mixed/">Mixed</a>
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
