<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { themes } from '$lib/themes';
	import { createAppearance } from '$lib/appearance.svelte';
	import { navigation } from '$lib/navigation';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import ThemeStyles from '$lib/ThemeStyles.svelte';
	import '../app.css';
	let { children } = $props();
	const appearance = createAppearance();
	const theme = $derived(themes[appearance.colorScheme]);
	onMount(appearance.start);
</script>

<svelte:head
	><meta
		name="description"
		content="A showcase of spatial experiences built with Spatial Elements."
	/></svelte:head
>
<ThemeStyles {themes} />
<BrandStageShell
	{theme}
	colorScheme={appearance.colorScheme}
	deviceOrientation
	items={navigation.map((item) => ({ ...item, current: page.url.pathname === item.href }))}
>
	{#snippet brand()}<a class="wordmark" href="/">Spatial Elements<span>Showcase</span></a>{/snippet}
	{#snippet right()}<ThemeSwitch {appearance} />{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	.wordmark {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-weight: 600;
		letter-spacing: -0.035em;
		line-height: 1.2;
		text-decoration: none;
	}
	.wordmark span {
		color: var(--showcase-focus);
		font-size: 11px;
		font-weight: 500;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
</style>
