<script lang="ts">
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import type { SpatialElementMediaItem } from '@spatial-elements/core/spatial-element/types';

	let { spatialElement, selectedId, onselect }: { spatialElement: SpatialElementData; selectedId?: string; onselect?: (media: SpatialElementMediaItem) => void } = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));
	const minimap = $derived({
		...spatialElement.minimap,
		...theme.minimapTheme,
		viewportColor: theme.minimapTheme.viewportColor ?? theme.colors.accent
	});
</script>

<aside class="spatial-element-rail" aria-label="SpatialElement images">
	{#each spatialElement.media as media (media.id)}
		<div
			class="spatial-element-media-anchor"
			data-spatial-element-dock-minimap-anchor={media.kind === 'minimap' ? '' : undefined}
		>
			<Panel
				catalogEndpoint={media.kind === 'minimap'
					? { brandId: theme.id, spatialElementId: spatialElement.id, slot: 'detail.dock', role: 'geometry' }
					: undefined}
				transitionGroup="enter"
				class={`thumbnail-panel ${media.kind === 'minimap' ? 'active' : ''}`}
				shape={{ ...theme.panelShape, radius: radii.control, contentInset: 0 }}
				theme={theme.panelTheme}
				contentClass="thumbnail-panel-content"
				minimap={media.kind === 'minimap' ? minimap : false}
				data-spatial-element-departing-media-content={media.kind === 'minimap' ? undefined : ''}
			>
				{#if media.kind === 'minimap'}
					<button type="button" aria-label={media.label} aria-pressed={selectedId ? selectedId === media.id : true} onclick={() => onselect?.(media)} class="thumb thumb-minimap active">
						{#if spatialElement.fallbackImage}
							<img class="minimap-poster" src={spatialElement.fallbackImage} alt="" />
						{/if}
					</button>
				{:else if media.kind === 'drawing'}
					<button type="button" aria-label={media.label} onclick={() => onselect?.(media)} class="thumb thumb-drawing">
						<span class="drawing-sheet" aria-hidden="true"></span>
					</button>
				{:else if media.kind === 'image'}
					<button type="button" aria-label={media.label} aria-pressed={selectedId === media.id} onclick={() => onselect?.(media)} class="thumb thumb-image">
						<img src={media.src} alt={media.alt} />
					</button>
				{:else}
					<button type="button" aria-label={media.label} aria-pressed={selectedId === media.id} onclick={() => onselect?.(media)} class="thumb thumb-image">
						{#if media.poster}<img src={media.poster} alt="" />{:else}<span aria-hidden="true">▶</span>{/if}
					</button>
				{/if}
			</Panel>
		</div>
	{/each}
</aside>

<style>
	.spatial-element-rail {
		position: relative;
		flex: none;
		width: calc(100% - var(--spatial-detail-media-left) * 2);
		height: var(--spatial-detail-media-size);
		margin-top: var(--spatial-detail-media-stage-gap);
		margin-left: var(--spatial-detail-media-left);
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: var(--spatial-detail-media-size);
		gap: var(--spatial-detail-media-gap);
		justify-content: start;
		justify-items: start;
		overflow-x: auto;
		overflow-y: hidden;
		overscroll-behavior: contain;
		pointer-events: auto;
	}

	.spatial-element-media-anchor {
		width: 100%;
		aspect-ratio: 1;
	}

	:global(.thumbnail-panel) {
		width: 100%;
		height: 100%;
	}

	:global(.thumbnail-panel-content) {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
	}

	.thumb {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: var(--spatial-element-control-radius);
		background: transparent;
		cursor: pointer;
	}

	.thumb.active:not(.thumb-minimap) {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--spatial-element-accent) 82%, transparent);
	}

	.thumb-minimap {
		position: relative;
		overflow: hidden;
	}

	.minimap-poster {
		position: absolute;
		inset: 10%;
		width: 80%;
		height: 80%;
		object-fit: contain;
		transition: opacity 240ms ease;
	}

	:global(.stage-enhanced) .minimap-poster { opacity: 0; }

	@media (prefers-reduced-motion: reduce) {
		.minimap-poster { transition: none; }
	}

	.thumb-image img {
		display: block;
		max-width: calc(100% - 18px);
		max-height: calc(100% - 18px);
		object-fit: contain;
	}

	.drawing-sheet {
		position: relative;
		width: 74px;
		height: 74px;
		border: 1px solid rgb(74 137 205 / 0.34);
		background:
			linear-gradient(135deg, transparent 46%, rgb(46 117 191 / 0.26) 46% 54%, transparent 54%),
			repeating-linear-gradient(0deg, transparent 0 12px, rgb(74 137 205 / 0.16) 12px 13px),
			repeating-linear-gradient(90deg, transparent 0 12px, rgb(74 137 205 / 0.16) 12px 13px),
			rgb(255 255 255 / 0.82);
	}

	.drawing-sheet::before {
		position: absolute;
		inset: 15px 17px 20px 15px;
		border: 1px solid rgb(74 137 205 / 0.8);
		border-radius: 2px;
		content: '';
	}

	.drawing-sheet::after {
		position: absolute;
		right: 6px;
		bottom: 7px;
		color: rgb(74 137 205 / 0.8);
		font:
			600 7px/1 system-ui,
			sans-serif;
		content: '100 mm';
	}

	@media (min-width: 840px) {
		.spatial-element-rail {
			position: absolute;
			top: 0;
			left: var(--spatial-detail-media-left);
			width: var(--spatial-detail-media-size);
			height: var(--spatial-detail-fit-height);
			margin: 0;
			grid-auto-flow: row;
			grid-auto-columns: 100%;
			grid-auto-rows: max-content;
			align-content: start;
			overflow-x: hidden;
			overflow-y: auto;
		}
	}
</style>
