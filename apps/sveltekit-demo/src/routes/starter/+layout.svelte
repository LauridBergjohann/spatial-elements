<script lang="ts">
	import type { Snippet } from 'svelte';
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { starterTheme } from '$lib/starter';
	let { children }: { children: Snippet } = $props();
</script>

<BrandStageShell theme={starterTheme}>
	{#snippet menu()}<nav aria-label="Main navigation">
			<a href="/starter/categories/list">My collection</a>
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
		color: var(--spatial-element-ink);
		font-weight: 600;
		text-decoration: none;
	}
</style>
