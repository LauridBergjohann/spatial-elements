<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection,
		getSpatialListItems
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import { spatialElements } from '$lib/catalog';
	const list = getSpatialListItems(spatialElements.slice(0, 3), '/story');
</script>

<ContentPage hdr="/assets/demo/studio.hdr" page={{ title: 'curated' }}>
	<HeadingSection section={{ id: 'heading', title: 'curated', headingLevel: 1 }} />
	<Section section={{ id: 'routes', title: 'Compositions' }}
		><nav aria-label="Composition routes">
			<a href="/curated">Curated</a> <a href="/gallery">Gallery</a>
			<a href="/exhibition">Exhibition</a> <a href="/rotation">Rotation</a>
			<a href="/reading">Ordinary page</a>
		</nav></Section
	>
	<SpatialCardGridSection
		section={{ id: 'collection', title: 'Forms' }}
		{list}
		cardSize="l"
		cardTone="muted"
	/>
</ContentPage>
