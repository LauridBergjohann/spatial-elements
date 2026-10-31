<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>
<SpatialElementPage spatialElement={data.element}>
	<Section section={{ id: 'reading', title: 'Reading', headline: 'The shared layout contract', background: { color: 'standard' } }}>
		{#each Array.from({ length: 18 }, (_, index) => index) as index}<p>Chapter {index + 1}: The document scrolls normally. The stage and its docked header share known layout anchors; the early transition can move an existing model before this page mounts.</p>{/each}
	</Section>
	<Section section={{ id: 'more', title: 'More' }}><div style="min-height:120vh"><p>Further document content keeps the reading anchor reachable without artificial navigation offsets.</p></div></Section>
</SpatialElementPage>
