# Author a catalog

Start with the executable [getting-started guide](getting-started.md) and the [API reference](api.md).

Use a persistent brand layout with BrandStageShell and a SpatialTheme. Create a theme with
createSpatialTheme({ id, name }) and optional appearance overrides. Define geometry: { low, high }, detail hdr and other
model settings directly on SpatialElementData. ContentPage and SpatialElementPage register
their own data; ListSection and CarouselSection register their own occurrences. Layouts do
not need stage or catalog props. Asset identity remains element identity.

~~~svelte
<script lang="ts">
  import { ContentPage, Section, ListSection, CarouselSection } from '@spatial-elements/sveltekit';
  let { data } = $props();
</script>
<ContentPage hdr="/assets/category.hdr" page={{ title: 'Collection', breadcrumbs: [{ label: 'Elements' }] }}>
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

Set category lighting explicitly through ContentPage.hdr (also required by SpatialListPage). No HDR is inferred from list contents.

Declare low/high LODs in one common coordinate frame; a verified physical frame needs independently
validated dimensions. The generated demo uses provisional shared frames. Provide accessible posters
for fallback rendering. No default element model or third-party environment is bundled. Supply a
Draco decoder directory with the BrandStageShell dracoDecoderPath prop (trailing slash, base-path aware) when using Draco;
the compatibility default is /assets/draco/gltf/. Meshopt uses the Three.js decoder dependency.

Asset URLs, base-path resolution, content fetching and deployment are application responsibilities.
Inspect apps/sveltekit-demo/src/lib/catalog.ts and its routes for a complete working example.

## Touch and pointer interaction

Carousel model areas coordinate horizontal rotation and vertical page scrolling, including diagonal gestures and changes of direction within one gesture. Both axes continue with damped momentum after release; a new touch or wheel input stops page momentum. Two-finger page zoom and scrolling outside the model area remain native. A stationary tap selects a neighbour; activating the already-selected model opens its detail using the same transition as More information. Drag release does not navigate. Buttons and keyboard controls remain available. Reduced-motion preferences disable momentum.

Cards reserve one eyebrow line and two title lines. Truncated titles expose their complete text through a native card tooltip; full text remains available on the detail page. Mouse hover and keyboard focus raise card text, enlarge the model and highlight the card outline in the accent color. Carousel models use the detail interaction theme's silhouette glow, including the selected model. Hover or keyboard focus smoothly removes their defocus, and a native tooltip identifies the element using its eyebrow and complete title. Carousel indicators follow movement immediately, and dot selections animate across intermediate elements (except under reduced motion). Defocus increases with distance from the center, and summary panels soften as they fade.

Before WebGPU is ready, carousels are native horizontal scroll-snap rails with working detail links and anchor controls, including without JavaScript. Their shared CSS grid reserves the same content height and selected panel frame as the spatial presentation. Selections made while loading are retained when enhancement succeeds. GPU failure keeps the native presentation available. Keep fallback images representative of the initial model view; poster fades soften the handoff, but authored image framing still determines silhouette alignment.

The enhanced carousel fits its visible elements to the viewport rather than a fixed item count. Wide screens can show more neighbours; phone layouts normally show the selected model and its two neighbours. Spacing follows the model framing envelope with additional clearance, and only a small area beyond the viewport is prepared. Posters and hit targets use the same visibility decision, so preparation never exposes an unselectable image. Section metrics are cached on resize, not measured during animation.

On detail pages, a touch starting on visible model geometry rotates it, and a second finger on the canvas enables pinch zoom. Lifting one finger returns to rotation; lifting all fingers ends the gesture. A new touch outside the geometry scrolls the page immediately. Ordinary HTML controls retain their own touch behavior.

Panel, minimap and model hover effects require a mouse pointer. Touch and stylus contact clear those effects, including on devices that also have a mouse. Keyboard focus indicators remain available.

Detail pages also provide a compact, themed help button and once-per-session interaction guidance. Before the first manual interaction, the model subtly follows nearby mouse movement and then settles; reduced motion disables this preview. Configure all help strings through the shell's `messages` prop. See [interface texts and help](interface-texts.md) for translation examples, defaults, placement and lifecycle behavior.

Keep native scrolling enabled on the page and avoid overriding the components' `touch-action` styles or cancelling their touch events in application-level handlers.

## Rendering budget

`BrandStageShell`, `Stage`, and the core `StageExperience` accept `renderSettings`.
WebGPU output defaults to a maximum pixel ratio of 1 and a per-canvas pixel budget
of 2,073,600. Large viewports can render below one physical pixel per CSS pixel to
stay within that budget. DOM text and layout retain their native resolution.
Opt into denser 3D output with `renderSettings={{ maxPixelRatio: 1.5 }}`.
Use `renderSettings={{ maxPixelRatio: 1, maxPixels: 1_500_000 }}` for a lower GPU
budget. To restore the previous output resolution, use
`renderSettings={{ maxPixelRatio: 2, maxPixels: null }}`. These settings belong on the
persistent stage; pass them at creation or when binding a new page. Invalid or
nonpositive values use the defaults.
