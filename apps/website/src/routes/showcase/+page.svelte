<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { showcaseElements as elements } from '$lib/showcase/collection';
	import { showcaseHdr } from '$lib/showcase/optimized';
</script>

<ContentPage
	page={{
		title: 'Showcase',
		breadcrumbs: []
	}}
	hdr={showcaseHdr}
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Showcase',
			headingLevel: 1,
			introduction: `Tools, desk essentials, industrial components and a timepiece. Explore ${elements.length} models from Wera, Logitech, item and Rolex, with product photographs and videos where available. This is a demonstration, not a shop.`
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
			For products and purchasing information, visit <a href="https://www.wera.de/">Wera</a>,
			<a href="https://www.logitech.com/">Logitech</a>,
			<a href="https://www.item24.com/">item</a> or <a href="https://www.rolex.com/">Rolex</a>.
		</p></Section
	>
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
		list={getSpatialListItems(elements, '/showcase/elements')}
		cardSize="l"
		cardTone="muted"
		mediaAspect="3/2"
	/>
</ContentPage>
