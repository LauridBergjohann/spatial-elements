<script lang="ts">
	import NativeIslandSlot from '$lib/persistence-island-proof/NativeIslandSlot.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>
<h1>Detail native flow</h1>
<section><p data-before-island>Different destination content before the summary.</p>
<NativeIslandSlot descriptor={data.islandPresentation} />
<p data-after-island>Destination content after the intrinsically sized summary.</p></section>
