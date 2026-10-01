<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.element}>
	<Section section={{ id: 'details', title: 'About this element' }}>
		<p>Rotate the model, zoom in, or return to the collection.</p>
		<a href="/starter/categories/list">Back to the collection</a>
	</Section>
</SpatialElementPage>
