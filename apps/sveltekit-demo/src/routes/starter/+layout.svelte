<script lang="ts">
	import type { Snippet } from 'svelte';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { starterTheme } from '$lib/starter';
	let { children }: { children: Snippet } = $props();
</script>

<BrandStageShell theme={starterTheme}>
	{@render children()}
</BrandStageShell>
