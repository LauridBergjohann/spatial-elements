<script lang="ts">
	import type { Snippet } from 'svelte';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { starterTheme } from '$lib/starter';
	let { children }: { children: Snippet } = $props();
</script>

<BrandStageShell theme={starterTheme}>
	{#snippet menu()}<nav aria-label="Main navigation">
			<a href="/starter/categories/list" aria-label="Spatial Elements demo home"
				><img src="/spatial-elements-logo.svg" width="32" height="32" alt="" />Spatial Elements
				<span>Demo</span></a
			>
		</nav>{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	nav {
		display: flex;
		align-items: center;
		height: 100%;
	}
	a {
		display: inline-flex;
		align-items: center;
		gap: 0.6rem;
		color: var(--spatial-element-ink);
		font-weight: 600;
		text-decoration: none;
	}
</style>
