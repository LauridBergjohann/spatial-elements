<script lang="ts">
	import { browser } from '$app/environment';
	import { createRawSnippet, getContext, onMount, untrack } from 'svelte';
	import { render } from 'svelte/server';
	import { SpatialSummaryHostController, SPATIAL_SUMMARY_HOST } from './spatialSummaryHost.svelte.js';
	import SpatialSummaryRoot from './SpatialSummaryRoot.svelte';
	import type { SpatialCardContext } from './spatialSummary.js';
	let { instanceKey, context }: { instanceKey: string; context: SpatialCardContext } = $props();
	const host = getContext<SpatialSummaryHostController | undefined>(SPATIAL_SUMMARY_HOST);
	if (!host) throw new Error('Spatial card slots require a BrandStageShell');
	const key = untrack(() => instanceKey);
	let mounted = $state(false);
	const raw = createRawSnippet(() => ({
		render: () => {
			if (browser) return '<div data-spatial-card-slot></div>';
			const output = render(SpatialSummaryRoot, {
				props: { content: host.content(), model: { kind: 'card', current: context, active: true } },
				context: host.contexts, idPrefix: `card-${encodeURIComponent(key).replaceAll('-', '%2D')}`
			});
			if (output.head) throw new Error('A persistent card must render synchronous content without svelte:head');
			return `<div data-spatial-card-slot><div data-spatial-presentation-root class="spatial-card-root">${output.body}</div></div>`;
		},
		setup: (slot) => host.attachCard(slot as HTMLElement, key, context)
	}));
	onMount(() => { mounted = true; });
	$effect(() => { if (mounted) host.updateCard(key, context); });
</script>
{@render raw()}
<style>
	:global([data-spatial-card-slot]), :global(.spatial-card-root) {
		width: 100%; height: 100%; min-width: 0; min-height: 0; transform-style: preserve-3d;
	}
</style>
