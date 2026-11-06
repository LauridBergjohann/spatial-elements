<script lang="ts">
	import { getAllContexts, getContext, onDestroy, onMount, setContext, type Snippet } from 'svelte';
	import { SpatialSummaryHostController, SPATIAL_SUMMARY_HOST } from './spatialSummaryHost.svelte.js';
	import type { SpatialSummaryContext, SpatialSummarySnippet } from './spatialSummary.js';
	import SpatialElementSummaryContent from './SpatialElementSummaryContent.svelte';
	import { SPATIAL_PRESENTATION_OWNER, type SpatialPresentationOwner } from './spatialPresentationOwner.js';
	let { summary, children }: { summary?: SpatialSummarySnippet; children?: Snippet } = $props();
	const controller = new SpatialSummaryHostController(() => renderSummary, getAllContexts());
	setContext(SPATIAL_SUMMARY_HOST, controller);
	const owner = getContext<SpatialPresentationOwner | undefined>(SPATIAL_PRESENTATION_OWNER);
	onMount(() => owner?.register(controller));
	onDestroy(() => controller.destroy());
</script>
{#snippet renderSummary(context: SpatialSummaryContext)}
	{#if summary}{@render summary(context)}{:else}
		<SpatialElementSummaryContent spatialElement={context.spatialElement} address={context.address} heading={context.heading} contentInset={context.contentInset} />
	{/if}
{/snippet}
{@render children?.()}
