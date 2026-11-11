<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { showcaseElements as elements } from '$lib/showcase/collection';
</script>

<ContentPage
	page={{
		title: 'Showcase',
		breadcrumbs: []
	}}
	hdr="/assets/lobe.hdr"
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Showcase',
			headingLevel: 1,
			introduction:
				'Tools and timepieces in one spatial collection. Explore eight Wera tools and a Rolex watch. These products cannot be purchased here.'
		}}
	/>
	<Section
		section={{ id: 'views', title: 'Explore the collection', headline: 'Explore the collection' }}
		><p>
			<a href="/showcase/categories/list/">Card grid</a> ·
			<a href="/showcase/categories/carousel/">Carousel</a>
			· <a href="/showcase/categories/mixed/">Mixed composition</a>
		</p>
		<p>
			For products and purchasing information, visit <a href="https://www.wera.de/">Wera</a> or
			<a href="https://www.rolex.com/">Rolex</a>.
		</p></Section
	>
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
		list={getSpatialListItems(elements, '/showcase/elements')}
		cardSize="m"
		cardTone="muted"
		mediaAspect="3/2"
	/>
</ContentPage>
