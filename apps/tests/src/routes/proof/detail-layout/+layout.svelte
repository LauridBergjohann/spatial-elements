<script lang="ts">
	import { BrandStageShell, type SpatialSummaryContext } from '@spatial-elements/sveltekit';
	import { page } from '$app/state';
	import { theme } from '$lib/catalog';
	import DetailFixtureSummary from '$lib/persistence-island-proof/DetailFixtureSummary.svelte';
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

{#snippet customSummary(context: SpatialSummaryContext)}<DetailFixtureSummary
		{context}
		long={page.params.variant === 'long'}
	/>{/snippet}
<BrandStageShell {theme} summary={page.params.variant === 'default' ? undefined : customSummary}>
	{#snippet menu()}<a href="/proof/detail-layout/default">Detail layout fixture</a>{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
</style>
