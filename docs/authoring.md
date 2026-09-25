# Author a catalog

Use a persistent brand layout with BrandStageShell. Supply a ProductBrandTheme and a
ProductStageConfig (including explicit glb and hdr URLs). Pass catalog with brandId, view
(content or detail), active productId/productStage and products: []. Sections register their
own occurrences; asset identity remains product identity. The demo layout shows reactive route data.

~~~svelte
<script lang="ts">
  import { ContentPage, Section, ListSection, CarouselSection } from '@spatial-elements/sveltekit';
  let { data } = $props();
</script>
<ContentPage page={{ title: 'Collection', breadcrumbs: [{ label: 'Products' }] }}>
  <Section section={{ id: 'introduction', title: 'Discover the collection' }}>
    <p>Your own text, images and links.</p>
  </Section>
  <ListSection section={{ id: 'products', title: 'Products' }} list={data.products} />
  <CarouselSection section={{ id: 'featured', title: 'Featured' }} list={data.products} />
</ContentPage>
~~~

On a detail route use ProductDetailPage with a ProductDetailData document and Section children.
Resolve required content in the route load function before navigation completes. Optional models
and backgrounds are prepared separately. Keep ordinary anchors for history, keyboard and no-JS
behavior. Current navigation recipes use /brand/categories/view and /brand/products/id routes;
arbitrary route structures are not yet configurable. The demo uses /demo/... .

Declare low/high LODs in one common coordinate frame; a verified physical frame needs independently
validated dimensions. The generated demo uses provisional shared frames. Provide accessible posters
for fallback rendering. No default product model or third-party environment is bundled. Supply a
Draco decoder directory with stage.dracoDecoderPath (trailing slash, base-path aware) when using Draco;
the compatibility default is /assets/draco/gltf/. Meshopt uses the Three.js decoder dependency.

Asset URLs, base-path resolution, content fetching and deployment are application responsibilities.
Inspect apps/sveltekit-demo/src/lib/catalog.ts and its routes for a complete working example.
