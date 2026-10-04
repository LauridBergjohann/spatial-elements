<script lang="ts">
	import type { Snippet } from 'svelte';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';

	let { label, children, onclick, expanded, controls, enabled = true, element = $bindable() }: {
		label: string;
		children: Snippet;
		onclick: (event: MouseEvent) => void;
		expanded?: boolean;
		controls?: string;
		enabled?: boolean;
		element?: HTMLButtonElement;
	} = $props();
	const theme = useSpatialTheme();
</script>

<div class="icon-frame">
	<Panel
		class="spatial-icon-panel"
		shape={{ radius: Math.min(12, theme.panelShape.radius), contentInset: 0 }}
		theme={theme.panelTheme}
		pointerReactive="lift"
		focusReactive={false}
		transitionGroup="enter"
	>
		<!-- Keep visibility on the button: Panel's content style also holds renderer positioning. -->
		<button bind:this={element} type="button" {onclick} aria-label={label} title={label}
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
		padding: 0; border: 0; border-radius: inherit; background: transparent;
		color: var(--spatial-element-ink); cursor: pointer; touch-action: manipulation;
	}
	.spatial-icon-button:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: 3px; }
</style>
