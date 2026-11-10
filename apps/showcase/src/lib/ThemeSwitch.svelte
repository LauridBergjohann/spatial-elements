<script lang="ts">
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import type { Appearance } from './appearance.svelte';
	let { appearance }: { appearance: Appearance } = $props();
</script>

<div class="theme-switch" role="group" aria-label="Appearance">
	<button
		type="button"
		aria-label="Light mode"
		title="Light mode"
		aria-pressed={appearance.ready ? appearance.colorScheme === 'light' : undefined}
		disabled={!appearance.ready}
		onclick={() => appearance.select('light')}><Sun size={18} aria-hidden="true" /></button
	>
	<button
		type="button"
		aria-label="Dark mode"
		title="Dark mode"
		aria-pressed={appearance.ready ? appearance.colorScheme === 'dark' : undefined}
		disabled={!appearance.ready}
		onclick={() => appearance.select('dark')}><Moon size={18} aria-hidden="true" /></button
	>
</div>

<style>
	.theme-switch {
		display: flex;
		width: 80px;
		height: 40px;
		border-radius: 8px;
		overflow: hidden;
	}
	button {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--spatial-element-ink);
		cursor: pointer;
	}
	button + button {
		border-left: 1px solid color-mix(in srgb, currentColor 16%, transparent);
	}
	button:hover,
	button[aria-pressed='true'] {
		background: var(--spatial-element-tab-background);
	}
	button:focus-visible {
		outline: 2px solid var(--showcase-focus);
		outline-offset: -3px;
	}
	button:disabled {
		opacity: 0.45;
		cursor: default;
	}
</style>
