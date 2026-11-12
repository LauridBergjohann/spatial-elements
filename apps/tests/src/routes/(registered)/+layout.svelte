<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { theme } from '$lib/catalog';
	let { children } = $props();
</script>

<BrandStageShell {theme}>{@render children()}</BrandStageShell>
