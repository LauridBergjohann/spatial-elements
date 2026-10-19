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

Cards reserve one eyebrow line and two title lines. Truncated titles expose their complete text through a native card tooltip; full text remains available on the detail page. Mouse hover and keyboard focus raise card text, enlarge the model and highlight the card outline in the accent color. Carousel models use the detail interaction theme's silhouette glow, including the selected model. Hover or keyboard focus smoothly removes their defocus, and a native tooltip identifies the element using its complete title. Carousel indicators follow movement immediately, and dot selections animate across intermediate elements (except under reduced motion). Defocus increases with distance from the center, and summary panels soften as they fade.

Before WebGPU is ready, carousels are native horizontal scroll-snap rails with visible native scrollbars, keyboard scrolling and working detail links, including without JavaScript. Pagination dots and previous/next arrows beside the model appear only after enhancement; arrows are hidden at their respective endpoints. Their shared CSS grid reserves the same content height and selected panel frame as the spatial presentation. Selections made while loading are retained when enhancement succeeds. GPU failure keeps the native presentation available. Keep fallback images representative of the initial model view; posters disappear immediately when their GPU model is ready, avoiding a duplicate silhouette during return transitions.

The enhanced carousel places elements on the front arc of a shared turntable, viewed at a ten-degree angle. The resting information panel stays parallel to the screen. Selection smoothly advances an element toward the viewer without a lateral offset; perspective determines its size and spacing without per-element scale compensation. Products rotate with their seats. A shared floor plane grounds different model sizes in the same scene. Directional shadows project the actual mesh triangles onto that plane, with lightly softened edges; neutral black silhouettes only darken the page background, without tinted floor patches or generic circular decals. Overlapping triangles resolve to one silhouette before compositing, using one bounded scratch target shared across products. Mouse proximity brings the approached corner toward the viewer by at most four degrees per axis, without moving its panel; dragging, touch and reduced-motion preferences disable this response. The floor fades with the catalog during detail handoff. The enhanced gesture surface spans the viewport width. Touch and trackpad gestures also work over panel text and controls; links and buttons retain tap activation. Mouse dragging can start on geometry, blank space or panel text, while buttons and links retain click behavior. During mouse or touch dragging, the initial panel fades out and the initial foreground advance retreats with travel. Passing seats stay on the ring without revealing panels; reversing the gesture does not restore the withdrawn presentation. Release commits selection and starts foreground advance alongside settling. Automatic focus/scrollIntoView adjustments cannot change the selected product. Dot and keyboard navigation retain the normal crossfade. Depth uses defocus without fog. Defocus withdraws with the foreground advance during a gesture, leaving the whole ring sharp; release restores foreground focus with the selected product. The arc fades out before wrapping, so long catalogs never duplicate seats; desktop layouts show up to seven elements and phone layouts normally show the selected model and its two neighbours. Neighbours can overlap in depth. Geometry, blur and hit targets may extend beyond their section; only the browser viewport clips the spatial presentation. Only the arc and a small preparation margin are loaded. Posters and hit targets use the same visibility decision, so preparation never exposes an unselectable image. Section metrics are cached on resize, not measured during animation. Detail transitions capture the complete current model and camera transforms, including an in-progress selection.

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
