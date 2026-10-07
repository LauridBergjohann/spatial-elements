<script lang="ts">
	import type { Snippet } from 'svelte';
	import { mouseHover } from '@spatial-elements/core/stage/mouseHover';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';

	let { label, children, onclick, expanded, controls, focusAnchor, enabled = true, element = $bindable() }: {
		label: string;
		children: Snippet;
		onclick: (event: MouseEvent) => void;
		expanded?: boolean;
		controls?: string;
		focusAnchor?: HTMLElement;
		enabled?: boolean;
		element?: HTMLButtonElement;
	} = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
</script>

<div class="icon-frame">
	<Panel
		class="spatial-icon-panel"
		shape={{ radius: Math.min(12, theme.panelShape.radius), contentInset: 0 }}
		theme={theme.panelTheme}
		pointerReactive={false}
		focusReactive="top-right"
		{focusAnchor}
		transitionGroup="enter"
	>
		<!-- Keep visibility on the button: Panel's content style also holds renderer positioning. -->
		<button bind:this={element} use:mouseHover type="button" {onclick} aria-label={label} title={label}
			disabled={!enabled}
			style:visibility={enabled ? 'visible' : 'hidden'}
			aria-expanded={expanded} aria-controls={controls} aria-haspopup={controls ? 'dialog' : undefined}
			class="spatial-icon-button">
			{@render children()}
		</button>
	</Panel>
</div>

<style>
	.icon-frame { width: 40px; height: 40px; flex: 0 0 40px; }
	/* The renderer moves panel contents into its projection layer; retain the anchor size. */
	.icon-frame :global(.spatial-icon-panel) { width: 40px; height: 40px; }
	.spatial-icon-button {
		box-sizing: border-box; display: grid; place-items: center; width: 40px; height: 40px;
		padding: 0; border: 0; border-radius: min(12px, var(--spatial-element-panel-radius)); background: transparent;
		color: var(--spatial-element-ink); cursor: pointer; touch-action: manipulation;
		transition: background-color 180ms ease;
	}
	.spatial-icon-button:global([data-mouse-hover]):hover {
		background: color-mix(in srgb, var(--spatial-element-body) 8%, transparent);
	}
	.spatial-icon-button:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: 3px; }
	@media (prefers-reduced-motion: reduce) { .spatial-icon-button { transition: none; } }
</style>
