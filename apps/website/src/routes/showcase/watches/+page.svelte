<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { watchesSpatialElements as elements } from '$lib/showcase/watches';
</script>

<ContentPage
	page={{
		title: 'The watch',
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: 'The watch' }]
	}}
	hdr="/assets/lobe.hdr"
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'The watch',
			headingLevel: 1,
			introduction: 'A spatial demonstration. These products cannot be purchased here.'
		}}
	/>
	<Section
		section={{ id: 'views', title: 'Explore the collection', headline: 'Explore the collection' }}
		><p>
			<a href="/showcase/watches/categories/list/">Card grid</a> ·
			<a href="/showcase/watches/categories/carousel/">Carousel</a>
			· <a href="/showcase/watches/categories/mixed/">Mixed composition</a>
		</p>
		<p>
			For products and purchasing information, visit <a href="https://www.rolex.com/">Rolex</a>.
		</p></Section
	>
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
		list={getSpatialListItems(elements, '/showcase/watches/elements')}
		cardSize="m"
		cardTone="muted"
		mediaAspect="3/2"
	/>
</ContentPage>
