<script lang="ts">
 import { BrandStageShell, Panel } from '@spatial-elements/sveltekit';
 import { theme } from '$lib/catalog';
 let { children } = $props();
</script>
<BrandStageShell {theme}>
 <div class="demo-shell">
 <Panel class="demo-header" pointerReactive={false} shape={{ ...theme.panelShape, contentInset: 11 }} theme={theme.panelTheme}>
 <nav aria-label="Main navigation"><a href="/demo/categories/mixed">Spatial Elements</a><a href="/demo/categories/list">List</a><a href="/demo/categories/carousel">Carousel</a><a href="/demo/categories/mixed">Mixed</a></nav>
 </Panel>
 {@render children()}
 </div>
</BrandStageShell>
<style>
 :global(body) { margin: 0; font-family: system-ui, sans-serif; }
 .demo-shell { position: relative; z-index: 1; min-height: 100vh; padding: 8px clamp(24px, 4vw, 80px) 100px; pointer-events: none; }
 .demo-shell:has(:global([data-spatial-element-root])) { min-height: 240vh; }
 :global(.demo-header) {
  position: relative;
  width: calc(100vw - var(--spatial-element-shell-inline-inset) - var(--spatial-element-shell-inline-inset));
  height: 66px;
  margin: 0 auto 10px;
  pointer-events: auto;
 }
 nav { display: flex; align-items: center; gap: 32px; width: 100%; height: 100%; }
 a { color: var(--spatial-element-body); text-decoration: none; white-space: nowrap; }
 nav a:first-child { font-weight: 700; margin-right: auto; }
 @media (max-width: 1100px) {
  .demo-shell { padding-inline: 20px; }
  :global(.demo-header) { width: 100%; }
  nav { gap: 12px; }
 }
 @media (max-width: 480px) {
  :global(.demo-header) { height: 88px; }
  nav { flex-wrap: wrap; justify-content: center; gap: 6px 20px; }
  nav a:first-child { flex-basis: 100%; margin: 0; text-align: center; }
 }
</style>
