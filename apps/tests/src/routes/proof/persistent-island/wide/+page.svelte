<script lang="ts">
	import NativeIslandSlot from '$lib/persistence-island-proof/NativeIslandSlot.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<h1>Wide native flow</h1>
<div>
	<p data-before-island>Wide destination content before the summary.</p>
	<NativeIslandSlot descriptor={data.islandPresentation} />
	<p data-after-island>Wide destination content after the summary.</p>
</div>
