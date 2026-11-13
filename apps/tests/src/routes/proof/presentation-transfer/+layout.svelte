<script lang="ts">
	import { BrandStageShell, type SpatialSummaryContext } from '@spatial-elements/sveltekit';
	import { theme } from '$lib/catalog';
	import Harness from '$lib/presentation-transfer-proof/Harness.svelte';
	import LiveSummary from '$lib/presentation-transfer-proof/LiveSummary.svelte';
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

{#snippet summary(context: SpatialSummaryContext)}<LiveSummary {context} />{/snippet}
<BrandStageShell {theme} {summary}><Harness>{@render children()}</Harness></BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
</style>
