<script lang="ts">
	import { getContext, onMount } from 'svelte';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import Play from 'lucide-svelte/icons/play';
	import OverflowControls from './OverflowControls.svelte';
	import SpatialMediaIndicator from './SpatialMediaIndicator.svelte';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import type { ResolvedSpatialElementData as SpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
	import type { SpatialElementMediaItem } from '@spatial-elements/core/spatial-element/types';

	let {
		spatialElement,
		selectedId,
		onselect
	}: {
		spatialElement: SpatialElementData;
		selectedId?: string;
		onselect?: (media: SpatialElementMediaItem) => void;
	} = $props();
	let rail = $state<HTMLElement>();
	const stage = getContext<StageContext>(STAGE_CONTEXT_KEY);
	const focused = $derived(
		(stage.getZoomUiFocus?.() ?? 0) > 0.01 || (stage.isFullscreen?.() ?? false)
	);
	let minimapInRail = $state(true);
	$effect(() => {
		if (!focused || !rail) return;
		// Zoom keeps the live minimap available even after browsing a long rail.
		// Its projected anchor must start inside the rail before it expands.
		rail.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		minimapInRail = true;
		refreshProjection();
	});
	let refreshFrame = 0;
	function refreshProjection() {
		if (!refreshFrame)
			refreshFrame = requestAnimationFrame(() => {
				refreshFrame = 0;
				minimapInRail = !rail || (rail.scrollTop < 1 && rail.scrollLeft < 1);
				window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
			});
	}
	$effect(() => {
		const id = selectedId;
		if (!rail || !id) return;
		const anchor = Array.from(rail.querySelectorAll<HTMLElement>('[data-media-id]')).find(
			(node) => node.dataset.mediaId === id
		);
		if (!anchor) return;
		const left = anchor.offsetLeft,
			top = anchor.offsetTop;
		if (left < rail.scrollLeft) rail.scrollLeft = left;
		else if (left + anchor.offsetWidth > rail.scrollLeft + rail.clientWidth)
			rail.scrollLeft = left + anchor.offsetWidth - rail.clientWidth;
		if (top < rail.scrollTop) rail.scrollTop = top;
		else if (top + anchor.offsetHeight > rail.scrollTop + rail.clientHeight)
			rail.scrollTop = top + anchor.offsetHeight - rail.clientHeight;
	});
	onMount(() => {
		const element = rail!;
		element.addEventListener('scroll', refreshProjection, { passive: true });
		return () => {
			element.removeEventListener('scroll', refreshProjection);
			cancelAnimationFrame(refreshFrame);
		};
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

<div class="rail-frame">
	<aside
		bind:this={rail}
		class="spatial-element-rail"
		data-spatial-element-media-rail
		aria-label="Product media"
	>
		{#each spatialElement.media as media (media.id)}
			{@const active = selectedId ? selectedId === media.id : media.kind === 'minimap'}
			<div
				class="spatial-element-media-anchor"
				data-media-id={media.id}
				data-spatial-element-dock-minimap-anchor={media.kind === 'minimap' ? '' : undefined}
			>
				<Panel
					catalogEndpoint={media.kind === 'minimap'
						? {
								brandId: theme.id,
								spatialElementId: spatialElement.id,
								slot: 'detail.dock',
								role: 'geometry'
							}
						: undefined}
					transitionGroup="enter"
					nativeContent={media.kind !== 'minimap'}
					pointerReactive
					visible={media.kind !== 'minimap' || minimapInRail || focused}
					minimapSelected={active}
					class={`thumbnail-panel ${active ? 'active' : ''}`}
					shape={{ ...theme.panelShape, radius: radii.control, contentInset: 0 }}
					theme={theme.panelTheme}
					contentClass="thumbnail-panel-content"
					minimap={media.kind === 'minimap' ? minimap : false}
					data-spatial-element-departing-media-content={media.kind === 'minimap' ? undefined : ''}
				>
					{#if media.kind === 'minimap'}
						<button
							type="button"
							aria-label={media.label}
							aria-pressed={active}
							onclick={() => onselect?.(media)}
							class="thumb thumb-minimap"
							class:active
						>
							{#if spatialElement.fallbackImage}
								<img class="minimap-poster" src={spatialElement.fallbackImage} alt="" />
							{/if}
							<span class="media-indicator"><SpatialMediaIndicator /></span>
						</button>
					{:else if media.kind === 'drawing'}
						<button
							type="button"
							aria-label={media.label}
							aria-pressed={active}
							onclick={() => onselect?.(media)}
							class="thumb thumb-drawing"
							class:active
						>
							<span class="drawing-sheet" aria-hidden="true"></span>
						</button>
					{:else if media.kind === 'image'}
						<button
							use:mouseHover
							data-media-fit={media.fit ?? 'contain'}
							type="button"
							aria-label={media.label}
							aria-pressed={active}
							onclick={() => onselect?.(media)}
							class="thumb thumb-image"
							class:active
						>
							<img
								style:object-fit={media.fit ?? 'contain'}
								src={media.thumbnail ?? media.src}
								alt={media.alt}
								loading="lazy"
								decoding="async"
							/>
						</button>
					{:else}
						<button
							use:mouseHover
							type="button"
							aria-label={media.label}
							aria-pressed={active}
							onclick={() => onselect?.(media)}
							class="thumb thumb-image thumb-video"
							class:active
						>
							{#if media.poster}<img
									src={media.poster}
									alt=""
									loading="lazy"
									decoding="async"
								/>{/if}<span class="play-indicator"><Play size={28} fill="currentColor" /></span>
						</button>
					{/if}
				</Panel>
			</div>
		{/each}
	</aside>
	<OverflowControls target={rail} responsive label="media" hidden={focused} />
</div>

<style>
	.rail-frame {
		position: relative;
		flex: none;
		width: calc(100% - var(--spatial-detail-media-left) * 2);
		height: var(--spatial-detail-media-size);
		margin-top: var(--spatial-detail-media-stage-gap);
		margin-left: var(--spatial-detail-media-left);
	}
	.spatial-element-rail {
		position: relative;
		width: 100%;
		height: 100%;
		scrollbar-width: none;
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

	.spatial-element-rail::-webkit-scrollbar {
		display: none;
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
		position: relative;
		padding: 0;
		overflow: hidden;
		min-width: 0;
		min-height: 0;
		color: var(--spatial-element-ink);
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 0;
		border-radius: var(--spatial-element-control-radius);
		background: transparent;
		cursor: pointer;
	}

	.thumb.active::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--spatial-element-accent) 96%, transparent);
		pointer-events: none;
	}
	:global(.stage-enhanced[data-stage-page-ready]) .thumb-minimap.active::after {
		display: none;
	}
	.media-indicator {
		position: absolute;
		bottom: 4px;
		right: 4px;
		display: grid;
		color: color-mix(in srgb, var(--spatial-element-ink) 45%, transparent);
		opacity: var(--stage-panel-surface-opacity, 1);
		pointer-events: none;
	}
	.play-indicator {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		color: #fff;
		background: #0009;
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

	:global(.stage-enhanced[data-stage-page-ready]) .minimap-poster {
		opacity: 0;
	}
	:global(.stage-enhanced[data-catalog-transition]) .minimap-poster {
		opacity: 0;
		transition: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.minimap-poster {
			transition: none;
		}
	}

	.thumb-image img {
		display: block;
		width: 100%;
		height: 100%;
		min-height: 0;
		min-width: 0;
		object-fit: contain;
		transform: translateZ(0);
		transition: transform 220ms ease;
	}
	.thumb-image { perspective: 600px; }
	.thumb-image:global([data-mouse-hover])[data-media-fit='contain'] img,
	.thumb-image[data-media-fit='contain']:focus-visible img {
		transform: translate3d(var(--stage-panel-parallax-x, 0px), var(--stage-panel-parallax-y, 0px), 24px) scale(1.035);
	}
	/* The photograph moves behind the tilted frame, like looking through a window.
	 * Overscan covers the small displacement; the rail remains the clipping owner. */
	.thumb-image:global([data-mouse-hover])[data-media-fit='cover'] img,
	.thumb-image[data-media-fit='cover']:focus-visible img {
		transform: translate(calc(-1 * var(--stage-panel-parallax-x, 0px)), calc(-1 * var(--stage-panel-parallax-y, 0px))) scale(1.12);
	}
	.thumb-video:global([data-mouse-hover]) img,
	.thumb-video:focus-visible img { transform: scale(1.04); }
	.play-indicator { transition: transform 220ms ease; }
	.thumb-video:global([data-mouse-hover]) .play-indicator,
	.thumb-video:focus-visible .play-indicator { transform: translate(-50%, -50%) scale(1.15); }
	@media (prefers-reduced-motion: reduce) {
		.thumb-image img, .play-indicator { transition: none; }
		.thumb-image:global([data-mouse-hover]) img,
		.thumb-image:focus-visible img,
		.thumb-image:global([data-mouse-hover])[data-media-fit] img,
		.thumb-image[data-media-fit]:focus-visible img { transform: none; }
		.thumb-video:global([data-mouse-hover]) .play-indicator,
		.thumb-video:focus-visible .play-indicator { transform: translate(-50%, -50%); }
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
		.rail-frame {
			position: absolute;
			top: 0;
			left: var(--spatial-detail-media-left);
			width: var(--spatial-detail-media-size);
			height: var(--spatial-detail-fit-height);
			margin: 0;
		}
		.spatial-element-rail {
			grid-auto-flow: row;
			grid-auto-columns: 100%;
			grid-auto-rows: max-content;
			align-content: start;
			overflow-x: hidden;
			overflow-y: auto;
		}
	}
</style>
