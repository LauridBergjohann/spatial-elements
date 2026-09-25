<script lang="ts">
 import { page } from '$app/state';
 import { BrandStageShell, Panel, type ProductDetailData } from '@spatial-elements/sveltekit';
 import { theme, products } from '$lib/catalog';
 let { children } = $props();
 const active = $derived((page.data as { product?: ProductDetailData }).product);
</script>
<BrandStageShell {theme} stage={active?.stage ?? products[0].stage} catalog={{ brandId:'demo', view:active ? 'detail':'content', productId:active?.id, productStage:active?.stage, products:[] }}>
 <div class="demo-shell" class:detail={Boolean(active)}>
 <Panel class="demo-header" pointerReactive={false} shape={theme.panelShape} theme={theme.panelTheme}>
 <nav aria-label="Main navigation"><a href="/demo/categories/mixed">Spatial Elements</a><a href="/demo/categories/list">List</a><a href="/demo/categories/carousel">Carousel</a><a href="/demo/categories/mixed">Mixed</a></nav>
 </Panel>
 {@render children()}
 </div>
</BrandStageShell>
<style>
 :global(body){margin:0;font-family:system-ui,sans-serif} .demo-shell{position:relative;min-height:100vh;padding:8px 24px 100px;pointer-events:none}.detail{min-height:240vh}
 :global(.demo-header){width:calc(100% - 336px);margin:0 auto 24px;pointer-events:auto}nav{display:flex;align-items:center;gap:32px;padding:16px}a{color:inherit}nav a:first-child{font-weight:700;margin-right:auto}@media(max-width:1100px){:global(.demo-header){width:100%}nav{gap:12px}}
</style>
