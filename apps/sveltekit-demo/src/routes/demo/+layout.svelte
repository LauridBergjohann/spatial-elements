<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { theme } from '$lib/catalog';
	let { children } = $props();
</script>


<BrandStageShell {theme} colorScheme="light">
	{#snippet menu()}
		<nav class="demo-navigation" aria-label="Main navigation">
			<a class="brand" href="/demo/categories/list">Spatial Elements <span>Basics</span></a>
			<div class="desktop-links">{@render links()}</div>
			<details class="compact-links">
				<summary>Menu</summary>
				<div class="menu-popover">{@render links()}</div>
			</details>
		</nav>
	{/snippet}
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
	.brand span { margin-left: 6px; font-size: 12px; font-weight: 400; }
	.desktop-links { display: flex; gap: 24px; }
	a { color: var(--spatial-element-body); text-decoration: none; white-space: nowrap; }
	summary { cursor: pointer; padding: 10px 8px; border-radius: var(--spatial-element-control-radius); }
	.compact-links { display: none; }
	.menu-popover { position: absolute; top: 100%; right: 0; display: grid; min-width: 160px; padding: 12px; gap: 12px; background: var(--spatial-element-section-standard); border-radius: var(--spatial-element-control-radius); box-shadow: 0 8px 30px #0003; }
	@media (max-width: 599px) { .desktop-links { display: none; } .compact-links { display: block; } .demo-navigation { gap: 4px; } }
</style>
