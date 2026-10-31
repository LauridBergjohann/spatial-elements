<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { onMount } from 'svelte';
	import { themes } from '$lib/catalog';
	import { createAppearance } from '$lib/appearance.svelte';
	import ThemeSwitch from '$lib/ThemeSwitch.svelte';
	import ThemeStyles from '$lib/ThemeStyles.svelte';
	const appearance = createAppearance('spatial-demo-appearance');
	const theme = $derived(themes[appearance.colorScheme]);
	onMount(appearance.start);
	let { children } = $props();
</script>

<ThemeStyles {themes} />
<BrandStageShell {theme} colorScheme={appearance.colorScheme}>
	{#snippet menu()}
		<nav class="demo-navigation" aria-label="Main navigation">
			<a class="brand" href="/demo/categories/mixed">Spatial Elements</a>
			<div class="desktop-links">{@render links()}</div>
			<div class="spatial-shell-compact-only"><ThemeSwitch {theme} {appearance} /></div>
			<details class="compact-links">
				<summary>Menu</summary>
				<div class="menu-popover">{@render links()}</div>
			</details>
		</nav>
	{/snippet}
	{#snippet right()}<ThemeSwitch {theme} {appearance} />{/snippet}
	{@render children()}
</BrandStageShell>

{#snippet links()}
	<a href="/demo/categories/list">List</a>
	<a href="/demo/categories/carousel">Carousel</a>
	<a href="/demo/categories/mixed">Mixed</a>
{/snippet}

<style>
	:global(body) { margin: 0; font-family: system-ui, sans-serif; }
	.demo-navigation { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; height: 100%; }
	.brand { margin-right: auto; font-weight: 700; }
	.desktop-links { display: flex; gap: 24px; }
	a { color: var(--spatial-element-body); text-decoration: none; white-space: nowrap; }
	summary { cursor: pointer; padding: 10px 8px; border-radius: var(--spatial-element-control-radius); }
	.compact-links { display: none; }
	.menu-popover { position: absolute; top: 100%; right: 0; display: grid; min-width: 160px; padding: 12px; gap: 12px; background: var(--spatial-element-section-standard); border-radius: var(--spatial-element-control-radius); box-shadow: 0 8px 30px #0003; }
	@media (max-width: 599px) { .desktop-links { display: none; } .compact-links { display: block; } .demo-navigation { gap: 4px; } }
</style>
