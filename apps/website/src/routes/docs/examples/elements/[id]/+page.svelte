<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.element}
	><Section
		section={{
			id: 'features',
			title: 'Explore the form',
			headline: 'Explore the form',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>A procedural model used to demonstrate shared layouts and navigation.</p>
		<a href="/docs/sections/playground/">Back to the playground</a></Section
	></SpatialElementPage
>
