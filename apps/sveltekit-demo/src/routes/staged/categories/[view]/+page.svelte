<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection,
		Section
	} from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage page={{ title: 'Known dock endpoints' }} hdr="/assets/demo/studio.hdr">
	{#if data.view === 'carousel'}<SpatialCarouselSection
			section={{ id: 'collection', title: 'Collection' }}
			list={data.items}
		/>
	{:else}<SpatialCardGridSection
			section={{ id: 'collection', title: 'Collection' }}
			list={data.items}
		/>{/if}
	<Section section={{ id: 'explanation', title: 'Endpoint contract' }}
		><p>
			These links explicitly open the fully docked reading view. Its document contains enough
			content for native anchor scrolling.
		</p></Section
	>
</ContentPage>
