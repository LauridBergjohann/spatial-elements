<script lang="ts">
	import NativeIslandSlot from '$lib/persistence-island-proof/NativeIslandSlot.svelte';
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
</script>

<h1>Source native flow</h1>
<p data-before-island>Native route content before the summary.</p>
<NativeIslandSlot descriptor={data.islandPresentation} />
<p data-after-island>Native route content after the summary.</p>
