<script lang="ts">
	import { HeadingSection } from '@page-sections/svelte';

	import { ContentPage, SpatialCardGridSection } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage hdr="/assets/demo/studio.hdr?category=starter" page={{ title: 'My collection' }}>
	<HeadingSection section={{ id: 'catalog', title: 'My collection', headingLevel: 1 }} />

	<SpatialCardGridSection
		section={{ id: 'elements', title: 'Elements', headline: 'Elements' }}
		list={data.items}
	/>
</ContentPage>
