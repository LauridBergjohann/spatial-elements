<script lang="ts">
	import { BrandStageShell } from '@spatial-elements/sveltekit';
	import { page } from '$app/state';
	import { theme } from '$lib/catalog';
	import { layoutExamples } from '$lib/layoutExamples';
	let { children } = $props();
	const items = $derived([
		...['List', 'Carousel', 'Mixed'].map((label) => ({
			id: label.toLowerCase(),
			label,
			href: '/demo/categories/' + label.toLowerCase(),
			current: page.url.pathname === '/demo/categories/' + label.toLowerCase()
		})),
		{
			id: 'layouts',
			label: 'Layouts',
			href: '/demo/layouts',
			children: [
				{
					id: 'overview',
					label: 'Overview',
					href: '/demo/layouts',
					current: page.url.pathname === '/demo/layouts'
				},
				...layoutExamples.map((example) => ({
					id: example.id,
					label: example.title,
					href: example.href,
					current: page.url.pathname === example.href
				}))
			]
		}
	]);
</script>

<BrandStageShell {theme} colorScheme="light" {items}>
	{#snippet brand()}<a class="brand" href="/demo/categories/list"
			>Spatial Elements <span>Basics</span></a
		>{/snippet}
	{@render children()}
</BrandStageShell>

<style>
	:global(body) {
		margin: 0;
		font-family: system-ui, sans-serif;
	}
	.brand {
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.brand span {
		margin-left: 6px;
		font-size: 12px;
		font-weight: 400;
	}
</style>
