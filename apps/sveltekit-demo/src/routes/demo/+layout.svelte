<script lang="ts">
	import { BrandStageShell, Panel } from '@spatial-elements/sveltekit';
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
	<div class="demo-shell">
		<div class="header-row">
			<Panel
				class="demo-header"
				pointerReactive={false}
				shape={{ ...theme.panelShape, contentInset: 11 }}
				theme={theme.panelTheme}
			>
				<nav aria-label="Main navigation">
					<a href="/demo/categories/mixed">Spatial Elements</a><a href="/demo/categories/list"
						>List</a
					><a href="/demo/categories/carousel">Carousel</a><a href="/demo/categories/mixed">Mixed</a
					>
				</nav>
			</Panel>
			<ThemeSwitch {theme} {appearance} />
		</div>
		{@render children()}
	</div>
</BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	.demo-shell {
		position: relative;
		z-index: 1;
		min-height: 100vh;
		padding: 8px clamp(24px, 4vw, 80px) 100px;
		pointer-events: none;
	}
	.demo-shell:has(:global([data-spatial-element-root])) {
		min-height: 240vh;
	}
	:global(.demo-header) {
		position: relative;
		width: 100%;
		min-width: 0;
		height: 66px;
		margin: 0;
		pointer-events: auto;
	}
	nav {
		display: flex;
		align-items: center;
		gap: 32px;
		width: 100%;
		height: 100%;
	}
	.header-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
		margin: 0 auto 10px;
		width: calc(100vw - 2 * var(--spatial-element-shell-inline-inset));
		pointer-events: auto;
	}
	a {
		color: var(--spatial-element-body);
		text-decoration: none;
		white-space: nowrap;
	}
	nav a:first-child {
		font-weight: 700;
		margin-right: auto;
	}
	@media (max-width: 1100px) {
		.demo-shell {
			padding-inline: 20px;
		}
		.header-row {
			width: 100%;
		}
		:global(.demo-header) {
			width: 100%;
		}
		nav {
			gap: 12px;
		}
	}
	@media (max-width: 680px) {
		.header-row {
			grid-template-columns: 1fr;
			justify-items: end;
		}
		:global(.demo-header) {
			height: 88px;
		}
		nav {
			flex-wrap: wrap;
			justify-content: center;
			gap: 6px 20px;
		}
		nav a:first-child {
			flex-basis: 100%;
			margin: 0;
			text-align: center;
		}
	}
</style>
