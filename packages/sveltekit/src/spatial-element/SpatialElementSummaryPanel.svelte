<script lang="ts">
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { onMount } from 'svelte';
	import SpatialSummarySlot from './SpatialSummarySlot.svelte';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';

	let { spatialElement, nativeContent = false }: { spatialElement: SpatialElementData; nativeContent?: boolean } = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));
	const contentInset = $derived(theme.panelShape.contentInset ?? Math.max(16, Math.round(theme.panelShape.radius * 0.7)));
	let presentation = $state<HTMLDivElement>(null!);
	let panelHeight = $state<number>();

	onMount(() => {
		// The stage reparents the rendered content. Keep its layout placeholder in
		// sync using untransformed content size, including wrapping and font loads.
		panelHeight = presentation.offsetHeight + contentInset * 2;
		const observer = new ResizeObserver(([entry]) => {
			const height = entry.borderBoxSize?.[0]?.blockSize ?? presentation.offsetHeight;
			panelHeight = Math.ceil(height + contentInset * 2);
		});
		observer.observe(presentation);
		return () => observer.disconnect();
	});
</script>

<div class="spatial-element-aside" data-spatial-summary-aside style:--summary-panel-height={panelHeight === undefined ? undefined : `${panelHeight}px`}>
	<Panel
		{nativeContent}
		catalogEndpoint={{
			brandId: theme.id,
			spatialElementId: spatialElement.id,
			slot: 'detail.summary',
			role: 'summary-surface'
		}}
		pointerReactive={false}
		transitionGroup="shared"
		class="spatial-element-panel"
		shape={{ ...theme.panelShape, radius: radii.panel, contentInset }}
		theme={theme.panelTheme}
		contentClass="stage-panel-content spatial-element-content"
		aria-labelledby="spatial-element-title"
		data-spatial-element-hero-panel-content
		data-shared-role="summary-surface"
		data-spatial-element-id={spatialElement.id}
	>
		<SpatialSummarySlot instanceKey={`detail:${theme.id}:${spatialElement.id}`} bind:element={presentation}
			context={{ spatialElement, contentInset, heading: 'h1', mode: 'detail',
				address: (role) => ({ brandId: theme.id, spatialElementId: spatialElement.id, slot: 'detail.summary', role }) }} />
	</Panel>
</div>

<style>
	.spatial-element-aside {
		position: relative;
		min-width: 0;
		width: var(--spatial-detail-summary-width);
		margin-top: var(--spatial-detail-summary-gap);
		margin-inline: auto;
	}

	:global(.spatial-element-panel) {
		position: relative;
		width: 100%;
		height: var(--summary-panel-height, auto);
		max-height: var(--spatial-detail-summary-max-height);
		min-height: 0;
		pointer-events: auto;
	}

	:global(.spatial-element-content) {
		position: relative;
		display: block;
		overflow: visible;
		color: color-mix(in srgb, var(--spatial-element-ink) 92%, transparent);
	}


	@media (min-width: 840px) {
		.spatial-element-aside { position: absolute; top: 0; right: var(--spatial-detail-summary-right); margin: 0; }
	}
</style>
