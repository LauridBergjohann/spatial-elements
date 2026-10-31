<script lang="ts">
	import { getAllContexts, onDestroy, setContext, type Snippet } from 'svelte';
	import { SpatialSummaryHostController, SPATIAL_SUMMARY_HOST } from './spatialSummaryHost.svelte.js';
	import type { SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';
	import SpatialElementSummaryContent from './SpatialElementSummaryContent.svelte';
	let { summary, children }: { summary?: SpatialSummarySnippet; children?: Snippet } = $props();
	const controller = new SpatialSummaryHostController(() => renderSummary, getAllContexts());
	setContext(SPATIAL_SUMMARY_HOST, controller);
	onDestroy(() => controller.destroy());
</script>
{#snippet renderSummary(context: SpatialSummaryContext)}
	{#if summary}{@render summary(context)}{:else}
		<SpatialElementSummaryContent spatialElement={context.spatialElement} address={context.address} heading={context.heading} contentInset={context.contentInset} />
	{/if}
{/snippet}
{@render children?.()}
