<script lang="ts">
	import { onMount } from 'svelte';
	import SpatialElementSummaryContent from './SpatialElementSummaryContent.svelte';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';

	let { spatialElement }: { spatialElement: SpatialElementData } = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const contentInset = $derived(theme.panelShape.contentInset ?? Math.max(16, Math.round(theme.panelShape.radius * 0.7)));
	let presentation = $state<HTMLDivElement>(null!);
	let panelHeight = $state<number>();

	onMount(() => {
		// The stage reparents the rendered content. Keep its layout placeholder in
		// sync using untransformed content size, including wrapping and font loads.
		panelHeight = Math.max(504, presentation.offsetHeight + contentInset * 2);
		const observer = new ResizeObserver(([entry]) => {
			const height = entry.borderBoxSize?.[0]?.blockSize ?? presentation.offsetHeight;
			panelHeight = Math.max(504, Math.ceil(height + contentInset * 2));
		});
		observer.observe(presentation);
		return () => observer.disconnect();
	});
</script>

<div class="spatial-element-aside" style:--summary-panel-height={panelHeight === undefined ? undefined : `${panelHeight}px`}>
	<Panel
		catalogEndpoint={{
			brandId: theme.id,
			spatialElementId: spatialElement.id,
			slot: 'detail.summary',
			role: 'summary-surface'
		}}
		pointerReactive={false}
		transitionGroup="shared"
		class="spatial-element-panel"
		shape={theme.panelShape}
		theme={theme.panelTheme}
		contentClass="stage-panel-content spatial-element-content"
		aria-labelledby="spatial-element-title"
		data-spatial-element-hero-panel-content
		data-shared-role="summary-surface"
		data-spatial-element-id={spatialElement.id}
	>
        <SpatialElementSummaryContent {spatialElement} {contentInset} heading="h1" bind:element={presentation}
            address={(role) => ({ brandId: theme.id, spatialElementId: spatialElement.id, slot: 'detail.summary', role })} />
	</Panel>
</div>

<style>
	.spatial-element-aside {
		position: relative;
		min-height: inherit;
	}

	:global(.spatial-element-panel) {
		position: sticky;
		top: var(--spatial-element-summary-sticky-top, 104px);
		width: min(494px, 100%);
		height: var(--summary-panel-height, auto);
		min-height: 504px;
		pointer-events: auto;
	}

	:global(.spatial-element-content) {
		position: relative;
		display: block;
		overflow: visible;
		color: color-mix(in srgb, var(--spatial-element-ink) 92%, transparent);
	}


	@media (max-width: 1100px) {
		.spatial-element-aside { min-height: 0; }
		:global(.spatial-element-panel) {
			position: relative;
			top: auto;
		}
	}
</style>
