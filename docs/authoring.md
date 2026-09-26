# Author a catalog

Use a persistent brand layout with BrandStageShell. Supply a SpatialTheme and a
SpatialStageConfig (including explicit glb and hdr URLs). Pass catalog with brandId, view
(content or detail), active spatialElementId/spatialElementStage and `spatialElements: []`. Sections register their
own occurrences; asset identity remains element identity. The demo layout shows reactive route data.

~~~svelte
<script lang="ts">
  import { ContentPage, Section, ListSection, CarouselSection } from '@spatial-elements/sveltekit';
  let { data } = $props();
</script>
<ContentPage page={{ title: 'Collection', breadcrumbs: [{ label: 'Elements' }] }}>
  <Section section={{ id: 'introduction', title: 'Discover the collection' }}>
    <p>Your own text, images and links.</p>
  </Section>
  <ListSection section={{ id: 'elements', title: 'Elements' }} list={data.spatialElements} />
  <CarouselSection section={{ id: 'featured', title: 'Featured' }} list={data.spatialElements} />
</ContentPage>
~~~

On a detail route use SpatialElementPage with a SpatialElementData document and Section children.
Resolve required content in the route load function before navigation completes. Optional models
and backgrounds are prepared separately. Keep ordinary anchors for history, keyboard and no-JS
behavior. Current navigation recipes use `/brand/categories/{list,carousel,mixed}` and
`/brand/elements/id` routes. The host-specific `/brand/products/id` spelling also remains supported;
arbitrary route structures are not yet configurable. The demo uses /demo/... .

Declare low/high LODs in one common coordinate frame; a verified physical frame needs independently
validated dimensions. The generated demo uses provisional shared frames. Provide accessible posters
for fallback rendering. No default element model or third-party environment is bundled. Supply a
Draco decoder directory with stage.dracoDecoderPath (trailing slash, base-path aware) when using Draco;
the compatibility default is /assets/draco/gltf/. Meshopt uses the Three.js decoder dependency.

Asset URLs, base-path resolution, content fetching and deployment are application responsibilities.
Inspect apps/sveltekit-demo/src/lib/catalog.ts and its routes for a complete working example.
