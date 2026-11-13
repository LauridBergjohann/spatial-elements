<script lang="ts">
	import { HeadingSection } from '@page-sections/svelte';

	import { SpatialCarouselSection, ContentPage, Section } from '@spatial-elements/sveltekit';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<ContentPage
	hdr="/assets/demo/studio.hdr"
	page={{ title: 'Carousel layout contract', breadcrumbs: [{ label: 'Layout proof' }] }}
>
	<HeadingSection section={{ id: 'catalog', title: 'Carousel layout contract', headingLevel: 1 }} />

	<SpatialCarouselSection
		section={{
			id: 'layout-carousel',
			title: 'Layout collection',
			background: data.background,
			headline: data.headline ? 'Layout collection' : undefined
		}}
		list={data.list}
	/>
	<Section
		section={{ id: 'following-content', title: 'Following content', headline: 'Following content' }}
	>
		<p>
			The document remains the vertical scroll owner while the carousel manages horizontal
			selection.
		</p>
		<div style="height:900px" aria-hidden="true"></div>
	</Section>
</ContentPage>
