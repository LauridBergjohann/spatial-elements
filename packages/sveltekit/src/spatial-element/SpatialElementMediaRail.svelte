<script lang="ts">
	import { onMount } from 'svelte';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import type { SpatialElementMediaItem } from '@spatial-elements/core/spatial-element/types';

	let { spatialElement, selectedId, onselect }: { spatialElement: SpatialElementData; selectedId?: string; onselect?: (media: SpatialElementMediaItem) => void } = $props();
	let rail: HTMLElement;
	let refreshFrame = 0;
	function refreshProjection() {
		if (!refreshFrame) refreshFrame = requestAnimationFrame(() => {
			refreshFrame = 0; window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
		});
	}
	$effect(() => {
		const id = selectedId;
		if (!rail || !id) return;
		const anchor = Array.from(rail.querySelectorAll<HTMLElement>('[data-media-id]')).find(node => node.dataset.mediaId === id);
		if (!anchor) return;
		const left = anchor.offsetLeft, top = anchor.offsetTop;
		if (left < rail.scrollLeft) rail.scrollLeft = left;
		else if (left + anchor.offsetWidth > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = left + anchor.offsetWidth - rail.clientWidth;
		if (top < rail.scrollTop) rail.scrollTop = top;
		else if (top + anchor.offsetHeight > rail.scrollTop + rail.clientHeight) rail.scrollTop = top + anchor.offsetHeight - rail.clientHeight;
	});
	onMount(() => {
		const element = rail;
		element.addEventListener('scroll', refreshProjection, { passive: true });
		return () => { element.removeEventListener('scroll', refreshProjection); cancelAnimationFrame(refreshFrame); };
	});
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));
	const minimap = $derived({
		...spatialElement.minimap,
		...theme.minimapTheme,
		viewportColor: theme.minimapTheme.viewportColor ?? theme.colors.accent
	});
</script>

<aside bind:this={rail} class="spatial-element-rail" aria-label="SpatialElement images">
	{#each spatialElement.media as media (media.id)}
		{@const active = selectedId ? selectedId === media.id : media.kind === 'minimap'}
		<div
			class="spatial-element-media-anchor"
			data-media-id={media.id}
			data-spatial-element-dock-minimap-anchor={media.kind === 'minimap' ? '' : undefined}
		>
			<Panel
				catalogEndpoint={media.kind === 'minimap'
					? { brandId: theme.id, spatialElementId: spatialElement.id, slot: 'detail.dock', role: 'geometry' }
					: undefined}
				transitionGroup="enter"
				class={`thumbnail-panel ${active ? 'active' : ''}`}
				shape={{ ...theme.panelShape, radius: radii.control, contentInset: 0 }}
				theme={theme.panelTheme}
				contentClass="thumbnail-panel-content"
				minimap={media.kind === 'minimap' ? minimap : false}
				data-spatial-element-departing-media-content={media.kind === 'minimap' ? undefined : ''}
			>
				{#if media.kind === 'minimap'}
					<button type="button" aria-label={media.label} aria-pressed={active} onclick={() => onselect?.(media)} class="thumb thumb-minimap" class:active>
						{#if spatialElement.fallbackImage}
							<img class="minimap-poster" src={spatialElement.fallbackImage} alt="" />
						{/if}
					</button>
				{:else if media.kind === 'drawing'}
					<button type="button" aria-label={media.label} aria-pressed={active} onclick={() => onselect?.(media)} class="thumb thumb-drawing" class:active>
						<span class="drawing-sheet" aria-hidden="true"></span>
					</button>
				{:else if media.kind === 'image'}
					<button type="button" aria-label={media.label} aria-pressed={active} onclick={() => onselect?.(media)} class="thumb thumb-image" class:active>
						<img src={media.src} alt={media.alt} />
					</button>
				{:else}
					<button type="button" aria-label={media.label} aria-pressed={active} onclick={() => onselect?.(media)} class="thumb thumb-image" class:active>
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
		/* Keep horizontal swipes in the rail, but let vertical gestures scroll
		 * the document, including when this rail has no vertical overflow. */
		overscroll-behavior-x: contain;
		overscroll-behavior-y: auto;
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
