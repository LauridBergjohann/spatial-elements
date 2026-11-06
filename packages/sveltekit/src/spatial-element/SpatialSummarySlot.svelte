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
				props: { content: host.content(), model: { kind: 'summary', current: context, active: true } }, context: host.contexts,
				idPrefix: `summary-${encodeURIComponent(key).replaceAll('-', '%2D')}`
			});
			const body = output.body;
			if (output.head) throw new Error('A persistent summary must render synchronous content without svelte:head');
			return `<div data-spatial-summary-slot><div data-spatial-presentation-root class="spatial-summary-island" data-presentation-mode="${context.mode}" style="--spatial-summary-content-inset:${context.contentInset}px">${body}</div></div>`;
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
</style>
