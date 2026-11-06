<script lang="ts">
	import { onMount } from 'svelte';
	let ready = $state(false);
	onMount(() => { ready = true; });
</script>
<h1 data-island-entry-ready={ready}>Outside the island owner</h1>
<a href="/proof/persistent-island/source">Enter island layout</a>
