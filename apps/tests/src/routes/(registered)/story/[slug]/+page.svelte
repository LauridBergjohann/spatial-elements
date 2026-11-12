<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.element}>
	<Section section={{ id: 'features', title: 'Features', headline: 'Details' }}
		><p>Route-independent detail.</p>
		<a href="/curated">Collection</a></Section
	>
</SpatialElementPage>
