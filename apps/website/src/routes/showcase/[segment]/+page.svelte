<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection
	} from '@spatial-elements/sveltekit';
	import { HeadingSection } from '@page-sections/svelte';
	import { showcaseHdr } from '$lib/showcase/optimized';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage
	hdr={showcaseHdr}
	page={{
		title: data.segment.title,
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: data.segment.title }]
	}}
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: data.segment.title,
			headingLevel: 1,
			introduction: data.segment.description
		}}
	/>
	{#if data.segment.id !== 'exclusive'}
		<SpatialCarouselSection
			section={{
				id: 'new-products',
				title: 'New products',
				headline: 'New products',
				background: { color: 'transparent', size: 'full' }
			}}
			list={data.items.slice(0, 3)}
		/>
	{/if}
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
		list={data.items}
		cardSize={data.segment.cardSize}
		cardTone="standard"
		mediaAspect="3/2"
	/>
</ContentPage>
