<script lang="ts">
	import { Section, SpatialElementPage } from '@spatial-elements/sveltekit';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>
<SpatialElementPage spatialElement={data.spatialElement}>
	<Section section={{ id: 'detail-specification', title: 'Specifications' }}>
		<p>The content follows the summary naturally on small screens and the known hero frame on larger screens.</p>
		<div style="height:1000px" aria-hidden="true"></div>
	</Section>
</SpatialElementPage>
