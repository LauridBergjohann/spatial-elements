<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { weraSpatialElements as elements } from '$lib/showcase/wera';
</script>

<ContentPage
	page={{
		title: 'Wera tools',
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: 'Wera tools' }]
	}}
	hdr="/assets/lobe.hdr"
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Wera tools',
			headingLevel: 1,
			introduction: 'A spatial demonstration. These products cannot be purchased here.'
		}}
	/>
	<Section
		section={{ id: 'views', title: 'Explore the collection', headline: 'Explore the collection' }}
		><p>
			<a href="/showcase/wera/categories/list/">Card grid</a> ·
			<a href="/showcase/wera/categories/carousel/">Carousel</a>
			· <a href="/showcase/wera/categories/mixed/">Mixed composition</a>
		</p>
		<p>
			For products and purchasing information, visit <a href="https://www.wera.de/">Wera</a>.
		</p></Section
	>
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
		list={getSpatialListItems(elements, '/showcase/wera/elements')}
		cardSize="m"
		cardTone="muted"
		mediaAspect="3/2"
	/>
</ContentPage>
