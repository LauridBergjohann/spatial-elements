<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { theme } from '$lib/staged-production-proof/catalog';
	import LiveSummary from '$lib/staged-production-proof/LiveSummary.svelte';
	let { children } = $props();
</script>

<BrandStageShell {theme}>
	{#snippet menu()}<nav aria-label="Main navigation">
			<a href="/staged/categories/list">List</a> <a href="/staged/categories/carousel">Carousel</a>
		</nav>{/snippet}
	{#snippet summary(context)}<LiveSummary {context} />{/snippet}
	{@render children()}
</BrandStageShell>
