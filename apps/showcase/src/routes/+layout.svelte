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

<svelte:head><meta name="description" content="A showcase of spatial experiences built with Spatial Elements." /></svelte:head>
<ThemeStyles {themes} />
<BrandStageShell {theme} colorScheme={appearance.colorScheme} deviceOrientation>
	{#snippet menu()}
		<nav class="showcase-navigation" aria-label="Main navigation">
			<a class="wordmark" href="/">Spatial Elements<span>Showcase</span></a>
			<div class="desktop-links">{@render links()}</div>
			<div class="spatial-shell-compact-only"><ThemeSwitch {appearance} /></div>
			<details class="compact-links">
				<summary>Menu</summary>
				<div class="menu-popover">{@render links()}</div>
			</details>
		</nav>
	{/snippet}
	{#snippet right()}<ThemeSwitch {appearance} />{/snippet}
	{@render children()}
</BrandStageShell>

{#snippet links()}
	{#each navigation as item}
		<a href={item.href} aria-current={page.url.pathname === item.href ? 'page' : undefined}>{item.label}</a>
	{/each}
{/snippet}

<style>
	.showcase-navigation { display: flex; align-items: center; gap: 24px; width: 100%; height: 100%; min-width: 0; position: relative; }
	.wordmark { display: flex; flex-direction: column; gap: 2px; margin-right: auto; font-weight: 600; letter-spacing: -.035em; line-height: 1.2; }
	.wordmark span { color: var(--showcase-focus); font-size: 11px; font-weight: 500; letter-spacing: .12em; text-transform: uppercase; }
	a { color: var(--spatial-element-ink); text-decoration: none; }
	a:hover { text-decoration: underline; text-underline-offset: 5px; }
	.desktop-links { display: flex; align-items: center; gap: 28px; font-size: 14px; }
	.compact-links { display: none; }
	summary { cursor: pointer; padding: 10px 6px; font-size: 14px; }
	.menu-popover { position: absolute; top: calc(100% + 8px); right: 0; display: grid; gap: 20px; min-width: 180px; padding: 20px; background: var(--spatial-element-section-standard); border: 1px solid var(--showcase-border); border-radius: 12px; box-shadow: 0 12px 32px #0002; }
	@media (max-width: 839px) { .desktop-links { display: none; } .compact-links { display: block; } .showcase-navigation { gap: 8px; } }
</style>
