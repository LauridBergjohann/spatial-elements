<script lang="ts">
	import { getContext } from 'svelte';
	import { PanelsTopLeft, Maximize } from 'lucide-svelte';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import { useSpatialMessages } from './messagesContext.js';
	let { enabled, focusAnchor, onchange }: { enabled: boolean; focusAnchor?: HTMLElement; onchange: () => void } = $props();
	const stage = getContext<StageContext>(STAGE_CONTEXT_KEY);
	const theme = useSpatialTheme();
	const readMessages = useSpatialMessages();
	const messages = $derived(readMessages());
	const fullscreen = $derived(stage.isFullscreen?.() ?? false);
	const zoomFocus = $derived(stage.getZoomFocus?.() ?? 0);
	const detailSelection = $derived(fullscreen ? 0 : 1 - Math.min(Math.max(zoomFocus, 0), 1));
	function select(active: boolean) {
		onchange();
		stage.setFullscreen?.(active);
		if (!active) stage.resetView();
	}
</script>

<div class="view-toggle-frame">
	<Panel class="view-toggle-panel" shape={{ ...theme.panelShape, radius: Math.min(12, theme.panelShape.radius), contentInset: 0 }} theme={theme.panelTheme}
		pointerReactive={false} focusReactive="top-right" {focusAnchor} transitionGroup="enter">
		<div class="view-toggle" use:mouseHover style:visibility={enabled ? 'visible' : 'hidden'} data-spatial-element-view-toggle>
			<button type="button" disabled={!enabled} aria-label={messages.controls.detailView} title={messages.controls.detailView}
				aria-pressed={!fullscreen && zoomFocus < 0.001} style:--selection={`${detailSelection * 8}%`} onclick={() => select(false)}>
				<PanelsTopLeft size={21} strokeWidth={1.8} aria-hidden="true" />
			</button>
			<button type="button" disabled={!enabled} aria-label={messages.controls.fullscreen} title={messages.controls.fullscreen}
				aria-pressed={fullscreen} style:--selection={fullscreen ? '8%' : '0%'} onclick={() => select(true)}>
				<Maximize size={21} strokeWidth={1.8} aria-hidden="true" />
			</button>
		</div>
	</Panel>
</div>

<style>
	.view-toggle-frame, .view-toggle-frame :global(.view-toggle-panel) { width: 80px; height: 40px; flex: 0 0 80px; }
	.view-toggle { --control-radius: min(12px, var(--spatial-element-panel-radius)); display: flex; width: 80px; height: 40px; border-radius: var(--control-radius); }
	button {
		box-sizing: border-box; display: grid; place-items: center; width: 40px; height: 40px;
		padding: 0; border: 0; background: color-mix(in srgb, var(--spatial-element-body) var(--selection), transparent); color: var(--spatial-element-ink);
		cursor: pointer; touch-action: manipulation; transition: background-color 180ms ease;
	}
	button:first-child { border-radius: var(--control-radius) 0 0 var(--control-radius); }
	button:last-child { border-radius: 0 var(--control-radius) var(--control-radius) 0; }
	button + button { border-left: 1px solid color-mix(in srgb, var(--spatial-element-body) 12%, transparent); }
	.view-toggle:global([data-mouse-hover]) button:hover {
		background: color-mix(in srgb, var(--spatial-element-body) 8%, transparent);
	}
	button:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: -2px; }
	@media (prefers-reduced-motion: reduce) { button { transition: none; } }
</style>
