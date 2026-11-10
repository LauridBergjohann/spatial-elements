<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { onMount } from 'svelte';
	import { themes } from '$lib/theme-proof/themes';
	import { createAppearance } from '$lib/theme-proof/appearance.svelte';
	import ThemeSwitch from '$lib/theme-proof/ThemeSwitch.svelte';
	import ThemeStyles from '$lib/theme-proof/ThemeStyles.svelte';
	const appearance = createAppearance('spatial-demo-appearance');
	const theme = $derived(themes[appearance.colorScheme]);
	onMount(appearance.start);
	let { children } = $props();
</script>

<ThemeStyles {themes} />
<BrandStageShell
	{theme}
	colorScheme={appearance.colorScheme}
	items={['List', 'Carousel', 'Mixed'].map((label) => ({
		id: label.toLowerCase(),
		label,
		href: '/proof/theming/categories/' + label.toLowerCase()
	}))}
>
	{#snippet brand()}<a href="/proof/theming/categories/mixed">Spatial Elements</a>{/snippet}
	{#snippet right()}<ThemeSwitch {theme} {appearance} />{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	a {
		font-weight: 700;
		text-decoration: none;
	}
</style>
