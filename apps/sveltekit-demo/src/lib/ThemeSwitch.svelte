<script lang="ts">
	import { ButtonGroup, type SpatialTheme } from '@spatial-elements/sveltekit';
	import { Sun, Moon, Monitor } from 'lucide-svelte';
	import type { Appearance } from './appearance.svelte';
	let { theme, appearance }: { theme: SpatialTheme; appearance: Appearance } = $props();
</script>

<ButtonGroup
	label="Appearance"
	iconOnly
	focusReactive
	shape={theme.panelShape}
	theme={theme.panelTheme}
	items={[
		{ value: 'light', label: 'Light mode' },
		{ value: 'dark', label: 'Dark mode' },
		{ value: 'system', label: 'System appearance' }
	]}
	value={appearance.preference}
	onchange={appearance.select}
>
	{#snippet content(item)}
		{#if item.value === 'light'}<Sun size={21} strokeWidth={1.8} aria-hidden="true" />
		{:else if item.value === 'dark'}<Moon size={21} strokeWidth={1.8} aria-hidden="true" />
		{:else}<Monitor size={21} strokeWidth={1.8} aria-hidden="true" />{/if}
	{/snippet}
</ButtonGroup>
