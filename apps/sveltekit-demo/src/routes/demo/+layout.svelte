<script lang="ts">
 import { BrandStageShell } from '@spatial-elements/sveltekit';
 import { theme } from '$lib/catalog';
 let { children } = $props();
 const items = ['List', 'Carousel', 'Mixed'].map(label => ({ id: label.toLowerCase(), label, href: '/demo/categories/' + label.toLowerCase() }));
</script>
<BrandStageShell {theme} colorScheme="light" {items}>
 {#snippet brand()}<a class="brand" href="/demo/categories/list">Spatial Elements <span>Basics</span></a>{/snippet}
 {@render children()}
</BrandStageShell>
<style>
 :global(body) { margin: 0; font-family: system-ui, sans-serif; }
 .brand { font-weight: 700; text-decoration: none; white-space: nowrap; }
 .brand span { margin-left: 6px; font-size: 12px; font-weight: 400; }
</style>
