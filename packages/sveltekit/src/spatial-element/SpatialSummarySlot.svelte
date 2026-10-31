<script lang="ts">
	import { browser } from '$app/environment';
	import { createRawSnippet, getContext, onMount, untrack } from 'svelte';
	import { render } from 'svelte/server';
	import { SpatialSummaryHostController, SPATIAL_SUMMARY_HOST } from './spatialSummaryHost.svelte.js';
	import SpatialSummaryRoot from './SpatialSummaryRoot.svelte';
	import type { SpatialSummaryContext } from './spatialSummary.js';
	let { instanceKey, context, element = $bindable() }: {
		instanceKey: string;
		context: SpatialSummaryContext;
		element?: HTMLDivElement;
	} = $props();
	const host = getContext<SpatialSummaryHostController | undefined>(SPATIAL_SUMMARY_HOST);
	if (!host) throw new Error('Spatial summary slots require a BrandStageShell');
	const key = untrack(() => instanceKey);
	let mounted = $state(false);
	const raw = createRawSnippet(() => ({
		render: () => {
			if (browser) return '<div data-spatial-summary-slot></div>';
			const output = render(SpatialSummaryRoot, {
				props: { content: host.content(), model: { current: context } }, context: host.contexts,
				idPrefix: `summary-${encodeURIComponent(key).replaceAll('-', '%2D')}`
			});
			const body = output.body;
			if (output.head) throw new Error('A persistent summary must render synchronous content without svelte:head');
			return `<div data-spatial-summary-slot><div data-spatial-summary-root class="spatial-summary-query" style="--spatial-summary-content-inset:${context.contentInset}px">${body}</div></div>`;
		},
		setup: (slot) => {
			element = slot as HTMLDivElement;
			return host.attach(element, key, context);
		}
	}));
	onMount(() => { mounted = true; });
	$effect(() => { if (mounted) host.update(key, context); });
</script>
{@render raw()}
<style>
	:global([data-spatial-summary-slot]) { min-width: 0; }
	:global(.spatial-summary-query) {
		container: spatial-summary / inline-size;
		width: 100%;
		min-width: 0;
		pointer-events: auto;
		max-height: max(0px, calc(var(--spatial-detail-summary-max-height, 100000px) - var(--spatial-summary-content-inset, 0px) * 2));
		overflow: auto;
		overscroll-behavior: contain;
	}
</style>
