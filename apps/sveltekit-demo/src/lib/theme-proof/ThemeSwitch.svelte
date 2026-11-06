<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import type { SpatialTheme } from '@spatial-elements/sveltekit';
	import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import Sun from 'lucide-svelte/icons/sun';
	import Moon from 'lucide-svelte/icons/moon';
	import Monitor from 'lucide-svelte/icons/monitor';
	import type { Appearance } from './appearance.svelte';
	let { theme, appearance }: { theme: SpatialTheme; appearance: Appearance } = $props();
	const id = $props.id();
	let trigger: HTMLButtonElement;
	let popup: HTMLDivElement;
	let ready = $state(false);
	function close() { if (popup?.matches(':popover-open')) popup.hidePopover(); }
	function position(opening = false) {
		if (!popup || (!opening && !popup.matches(':popover-open'))) return;
		const box = trigger.getBoundingClientRect();
		if (box.bottom <= 0 || box.top >= innerHeight) { close(); return; }
		const width = Math.min(240, innerWidth - 24);
		popup.style.left = Math.max(12, Math.min(box.right - width, innerWidth - width - 12)) + 'px';
		popup.style.top = Math.max(12, Math.min(box.bottom + 8, innerHeight - (popup.offsetHeight || 146) - 12)) + 'px';
	}
	function select(value: 'light' | 'dark' | 'system') {
		appearance.select(value);
		close();
		trigger.focus({ preventScroll: true });
	}
	beforeNavigate(close);
	onMount(() => {
		ready = true;
		const stop = subscribeStageScrollFrame(() => position(), STAGE_SCROLL_PRIORITY.dock);
		window.addEventListener('resize', close, { passive: true });
		return () => { stop(); window.removeEventListener('resize', close); };
	});
</script>

<button bind:this={trigger} class="appearance-trigger" type="button" popovertarget={id}
	aria-label="Appearance" title="Appearance" disabled={!ready}>
	{#if appearance.preference === 'light'}<Sun size={21} aria-hidden="true" />
	{:else if appearance.preference === 'dark'}<Moon size={21} aria-hidden="true" />
	{:else}<Monitor size={21} aria-hidden="true" />{/if}
</button>
<div bind:this={popup} {id} popover="auto" role="group" aria-label="Appearance"
	data-appearance-popover data-theme-id={theme.id} onbeforetoggle={(event) => { if (event.newState === 'open') position(true); }} ontoggle={() => position()}>
	<button type="button" aria-pressed={appearance.preference === 'light'} onclick={() => select('light')}><Sun size={19} aria-hidden="true" />Light mode</button>
	<button type="button" aria-pressed={appearance.preference === 'dark'} onclick={() => select('dark')}><Moon size={19} aria-hidden="true" />Dark mode</button>
	<button type="button" aria-pressed={appearance.preference === 'system'} onclick={() => select('system')}><Monitor size={19} aria-hidden="true" />System appearance</button>
</div>

<style>
	.appearance-trigger { display: grid; place-items: center; width: 40px; height: 40px; padding: 0; flex: none; border: 0; border-radius: var(--spatial-element-control-radius); background: transparent; color: var(--spatial-element-ink); cursor: pointer; }
	.appearance-trigger:disabled { opacity: .45; cursor: default; }
	[data-appearance-popover] { position: fixed; inset: auto; box-sizing: border-box; width: min(240px, calc(100vw - 24px)); margin: 0; padding: 12px; border: 1px solid color-mix(in srgb, var(--spatial-element-ink) 12%, transparent); border-radius: var(--spatial-element-control-radius); background: var(--spatial-element-section-standard); color: var(--spatial-element-ink); box-shadow: 0 8px 30px #0003; pointer-events: auto; }
	[data-appearance-popover] button { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 40px; padding: 8px; border: 0; border-radius: var(--spatial-element-control-radius); background: transparent; color: inherit; font: inherit; text-align: start; cursor: pointer; }
	[data-appearance-popover] button[aria-pressed='true'] { background: color-mix(in srgb, var(--spatial-element-ink) 10%, transparent); }
	button:focus-visible { outline: 2px solid var(--spatial-element-accent); outline-offset: -2px; }
</style>
