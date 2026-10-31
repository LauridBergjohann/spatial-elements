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
  <Section section={{ id: 'introduction', title: 'Discover the collection', headline: 'Discover the collection', background: { color: 'standard' } }}>
    <p>Your own text, images and links.</p>
  </Section>
  <ListSection section={{ id: 'elements', title: 'Elements', headline: 'Elements' }} list={data.spatialElements} />
  <CarouselSection section={{ id: 'featured', title: 'Featured', headline: 'Featured' }} list={data.spatialElements} />
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

## Layout, headings and section backgrounds

Keep `section.title` as the short navigation and accessibility label. Set `section.headline`
when the section should display a heading; omitting it leaves no heading or reserved heading
gap. To preserve an existing heading during migration, set `headline` to its previous `title`.
The section's anchor and generated detail navigation continue to use `id` and `title`.

Sections are transparent by default. Choose `background: { color: 'standard' }` or
`{ color: 'muted' }` for a solid section surface. The theme supplies those two colors through
`sectionBackgrounds`. On ContentPages, `size: 'full'` extends only the background to the
viewport edges; text and cards keep the same grid. A gradient such as
`{ color: 'transparentToMuted', size: 'full' }` runs from top to bottom. Gradients require
an effective full-width background. Detail sections always use standard width, so an invalid
gradient becomes its end color and produces a development diagnostic.

Use `ContentGrid` and `ContentBlock` for explicit content columns. Section owns the outer
padding; a grid adds only the gaps between blocks. Grid size follows the content container,
not the viewport: 4 columns below 600px, 6 from 600px, 8 from 840px and 12 from 1200px,
with a maximum container width of 1536px. Responsive spans inherit the last smaller size;
before the first specified size, or when `span` is omitted, a block fills the row. DOM order
remains reading and keyboard order.

~~~svelte
<script lang="ts">
  import { Section, ContentGrid, ContentBlock } from '@spatial-elements/sveltekit';
</script>

<Section section={{
  id: 'materials', title: 'Materials', headline: 'Built for everyday use',
  background: { color: 'muted' }
}}>
  <ContentGrid>
    <ContentBlock span={{ xs: 4, s: 6, m: 4 }}>
      <p>Material and finish information.</p>
    </ContentBlock>
    <ContentBlock span={{ xs: 4, s: 6, m: 4, l: 8 }}>
      <p>Care instructions and other independently authored content.</p>
    </ContentBlock>
  </ContentGrid>
</Section>
~~~

Ordinary Section children still work without a grid. Do not add another fixed margin around
every block or repeat the section padding. Grid gutters and typography change together at
the container boundaries. Theme `radii.control` styles cards and small controls;
`radii.panel` styles panels and detached section groups. The defaults are 12px and 16px.
An explicitly authored legacy `panelShape.radius` remains a fallback for both roles.
Set `ContentPage background="#f7f5f0"` for a page-specific flat color; this updates native and
enhanced backgrounds without changing the shared theme or HDR lighting.

Choose one `cardSize="s"`, `"m"` (default) or `"l"` per ListSection. Cards are square and
span 1, 2 or 4 grid columns respectively; large cards span 3 in the six-column grid.
`textAlign="start"` (default) or `"center"` aligns the eyebrow and title together.
Small cards show one title line and no eyebrow. Medium and large cards share a total budget
of two and three lines: a nonempty eyebrow uses one line, leaving the rest for the title.
Images and geometry fit the same 4:3 media slot without stretching. At narrow widths this
slot shrinks to preserve the specified text line heights inside the square card.

See the [layout migration guide](layout-migration.md) when updating existing pages and themes.

## Touch and pointer interaction

Carousel layout follows the same content grid as the surrounding sections. Keep its section
headline optional; omitting it also removes the heading gap from the height budget. On XS/S,
the carousel shows a compact title and optional eyebrow above the model. The reserved title
strip does not change when selection moves between items with and without an eyebrow. From M,
the full information panel has natural height and centers beside the selected model. Long
content scrolls within that panel instead of increasing the model frame. The detail link is an
arrow in the panel's upper-right corner and retains a complete accessible product name.

To author custom detail and carousel summaries, define the snippet in the persistent brand
layout rather than in an outgoing route:

~~~svelte
<BrandStageShell {theme}>
  {#snippet summary(context)}
    <ProductConfiguration {context} />
  {/snippet}
  {@render children()}
</BrandStageShell>
~~~

`ProductConfiguration` can contain genuine reactive state and controls. Use
`@container spatial-summary (...)` for its layout and `context.mode` for presentation-specific
content. Reserve space for the carousel's detail arrow in the custom heading. Keep page-head
metadata outside the snippet and load initial data before rendering. The framework supplies a
default summary when the snippet is omitted. Compact carousel UI is framework-owned; the full
summary remains in its keyed instance while hidden, retaining state across selection and
resizing. Use distinct `itemKey` values for repeated occurrences of one product.

Carousels use a native horizontal scroll-snap rail until WebGPU enhancement. The enhanced
carousel has one authoritative fractional turntable phase; it never drives or follows a native
scroll offset. PointerEvents cover mouse, touch and pen, including desktop touch browsers without
TouchEvents. Horizontal gestures work across the viewport and over panel text. Touch gestures may
start over links; taps retain activation and drags suppress their compatibility click. Native
vertical page scrolling and pinch zoom remain enabled through touch-action: pan-y pinch-zoom.
The browser owns a vertical gesture until release; horizontal gestures do not also scroll the page.

Dragging uses 220 CSS pixels per product, independent of viewport width. Endpoints offer elastic
resistance. Release predicts the stopping seat from pointer velocity and applies critical damping to its
position. Foreground advance and panel reveal start immediately and share that trajectory. Faster
flicks can cross several seats; holding still removes momentum. Boundaries increase damping to
avoid overshoot. Slow releases and cancellations use a short 240ms snap. Dots, arrows and keyboard
retain their normal crossfade. Interruptions, cancellation and history restoration use the same
motion state. A stationary tap selects a neighbour or opens the selected model's detail.

With a mouse, rendered text fragments in carousel summaries remain selectable; empty panel
space uses grab and starts a carousel drag. Active mouse drags use grabbing across the section.
A decorative, non-interactive cursor badge indicates horizontal travel, selected-model details,
or detail-model rotation. It follows mouse input only and hides over text and ordinary controls,
during page scrolling, keyboard input and catalog transitions. Native cursors remain visible.

Horizontal wheel input works over the entire section, including panels. Where WheelEvent.momentum
is available, its first inertial sample starts the same velocity-predicted damping and concurrent
foreground reveal as pointer release. Subsequent platform inertial samples are ignored.
Otherwise an adaptive 110-220ms idle window uses event cadence, never a low-speed threshold. This
is a fallback heuristic, not a physical trackpad finger-up signal. Unmarked platform momentum is
consumed as input; only its final residual velocity is projected, never the original peak again.
The detection delay does not erase that velocity. A single sample has no measurable release speed
and snaps normally. Wheel travel has no two-seat cap. Panels remain withdrawn during the gesture. Vertical wheel
input and control-wheel zoom retain browser behavior. Reduced motion removes selection animation.

Cards clamp text to the selected size's line budget. Truncated titles expose their complete text through a native card tooltip; full text remains available on the detail page. Mouse hover and keyboard focus raise card text, enlarge the model and highlight the card outline in the accent color. Carousel models use the detail interaction theme's silhouette glow, including the selected model. Hover or keyboard focus smoothly removes their defocus, and a native tooltip identifies the element using its complete title. Carousel indicators follow movement immediately, and dot selections animate across intermediate elements (except under reduced motion). Defocus increases with distance from the center, and summary panels soften as they fade.

Before WebGPU is ready, carousels are native horizontal scroll-snap rails with keyboard scrolling, pagination links and working detail links, including without JavaScript. Enhancement turns pagination links into controlled buttons and adds previous/next arrows beside the model; arrows are hidden at their respective endpoints. The rail's scrollbar is hidden while native scrolling remains available. The shared layout reserves the same fit frame before and after enhancement. Selections made while loading are retained when enhancement succeeds. GPU failure keeps the native presentation available. Keep fallback images representative of the initial model view; posters disappear immediately when their GPU model is ready, avoiding a duplicate silhouette during return transitions.

The enhanced carousel places elements on the front arc of a shared turntable, viewed at a ten-degree angle. The resting information panel stays parallel to the screen. Selection smoothly advances an element toward the viewer without a lateral offset; perspective determines its size and spacing without per-element scale compensation. Products rotate with their seats. A shared floor plane grounds different model sizes in the same scene. Directional shadows project the actual mesh triangles onto that plane, with lightly softened edges; neutral black silhouettes only darken the page background, without tinted floor patches or generic circular decals. Overlapping triangles resolve to one silhouette before compositing, using one bounded scratch target shared across products. Mouse proximity brings the approached corner toward the viewer by at most four degrees per axis, without moving its panel; dragging, touch and reduced-motion preferences disable this response. The floor fades with the catalog during detail handoff. The enhanced gesture surface spans the viewport width. Touch and trackpad gestures also work over panel text and controls; links and buttons retain tap activation. Mouse dragging can start on geometry, blank space or panel text, while buttons and links retain click behavior. During mouse or touch dragging, the initial panel fades out and the initial foreground advance retreats with travel. Passing seats stay on the ring without revealing panels; reversing the gesture does not restore the withdrawn presentation. Release commits selection and starts foreground advance alongside settling. Automatic focus/scrollIntoView adjustments cannot change the selected product. Dot and keyboard navigation retain the normal crossfade. Depth uses defocus without fog. Defocus withdraws with the foreground advance during a gesture, leaving the whole ring sharp; release restores foreground focus with the selected product. The arc fades out before wrapping, so long catalogs never duplicate seats; desktop layouts show up to seven elements and phone layouts normally show the selected model and its two neighbours. Neighbours can overlap in depth. Geometry, blur and hit targets may extend beyond their section; only the browser viewport clips the spatial presentation. Only the arc and a small preparation margin are loaded. Posters and hit targets use the same visibility decision, so preparation never exposes an unselectable image. Section metrics are cached on resize, not measured during animation. Detail transitions capture the complete current model and camera transforms, including an in-progress selection.

On flow-layout detail pages, a touch starting on visible model geometry rotates it, and a second finger on the canvas enables pinch zoom. Lifting one finger returns to rotation; lifting all fingers ends the gesture. A new touch outside the geometry scrolls the page immediately. In the 3XL split layout, the free left area controls the selected 3D model; hiding the pane for zoom extends that free area across the viewport. A gesture keeps its initial owner until release. Ordinary HTML controls retain their own touch behavior.

Detail `media` supports images, native video and explicit YouTube selections alongside the initial 3D view. Images and video use `object-fit: contain`; selecting either pauses the hidden main 3D scene and its sensor motion. Native video starts only through its controls and stops when removed. Provide caption tracks for spoken or otherwise meaningful audio. With image/video selected, the free left area in 3XL scrolls the document. A foreign player iframe owns events inside its own document. Returning from the collection starts with the 3D view again. See [media fields, examples and input boundaries](design/layout/media-and-input.md).

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
