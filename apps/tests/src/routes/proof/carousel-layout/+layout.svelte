<script lang="ts">
	import { BrandStageShell, type SpatialSummaryContext } from '@spatial-elements/sveltekit';
	import { page } from '$app/state';
	import { theme } from '$lib/catalog';
	import CarouselFixtureSummary from '$lib/carousel-layout-proof/CarouselFixtureSummary.svelte';
	import type { LayoutProps } from './$types';
	let { children }: LayoutProps = $props();
</script>

{#snippet customSummary(context: SpatialSummaryContext)}<CarouselFixtureSummary
		{context}
		long={Boolean(page.data.carouselLong)}
	/>{/snippet}
<BrandStageShell {theme} summary={page.data.carouselCustom ? customSummary : undefined}>
	{#snippet menu()}<a href="/proof/carousel-layout">Carousel layout fixture</a>{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
</style>
