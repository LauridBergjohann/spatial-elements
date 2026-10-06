# Runtime scenarios and ownership

## Page-owned configuration

Each persistent Stage owns a SpatialPageRegistry; no module-global page state is used.
ContentPage registers a content-page getter with its explicit HDR and SpatialElementPage a getter for its current
element. The adapter derives its internal CatalogPage and renderer scene from that registration;
the layout supplies only the theme, renderer budget and decoder infrastructure. List and carousel
sections register their own occurrences independently. During route overlap, unregistering an
outgoing page cannot clear the newer page's registration. Svelte context scopes ownership to
the shell; registration happens on mount, while SSR renders ordinary page content.

Public geometry always supplies Low and High. The adapter normalizes URL shorthand into versioned resource requests; identical URLs use the same resource identity across roles. Generated frame metadata remains optional; Low determines the shared fit otherwise.

## Prepared navigation

~~~mermaid
sequenceDiagram
  participant User
  participant Adapter as SvelteKit adapter
  participant Prepare as CatalogPreparation
  participant Runtime as Stage runtime
  User->>Adapter: Hover/focus or activate element link
  Adapter->>Prepare: Request optional assets and preparation
  Prepare->>Runtime: Decode, instantiate and warm when gate allows
  User->>Adapter: Navigate
  Adapter->>Runtime: Capture source presentation and retain resources
  Adapter->>Adapter: Resolve route data, mount, restore scroll/selection
  Adapter->>Runtime: Measure and bind destination
  Runtime->>Runtime: Freeze readiness and start motion clock
  Runtime->>Runtime: Animate shared pose and independent reveal channels
  Prepare-->>Runtime: Late readiness, if needed
  Runtime->>Runtime: Refine after motion, hand off and release captures
~~~

The diagram describes responsibilities, not a promise that every hover finishes preparation. Required route load data must settle before destination layout is measured. Required Low bindings must be drawable before the motion clock starts. Navigation must still complete if no valid shared endpoint can be captured.

Readiness includes decoding, representation creation, material/environment preparation, warm rendering and relevant submitted GPU work. [PreparationGate](../../packages/core/src/catalog/PreparationGate.ts) postpones expensive preparation during protected motion; network fetches may continue. Already executing work cannot be preempted.

Current [timing policy](../../packages/core/src/catalog/transitionTiming.ts):

| Channel | Prepared | Deferred |
| --- | --- | --- |
| Old content | 0-140 ms, quadratic opacity decay | Same |
| Shared panel, text and geometry | 0-400 ms, ease-out quad | Same |
| New content / refinement | 0-400 ms, ease-in-out sine | After motion and readiness, 300 ms reveal |
| Background | 0-400 ms when independently prepared | After motion and its own readiness |

A prepared background stays revealed when High arrives later. Readiness is not reclassified halfway through shared motion. Timings are animation-clock policy, not an end-to-end latency guarantee.

## Identity, history and interruption

Endpoints match semantic brand/element/role and then a concrete slot/occurrence. Multiple lists and carousels can contain the same element. Carousel neighbours and partially visible elements can participate; absence of a valid drawable source/destination falls back to ordinary navigation. During intermediate detail page docking the hero remains the source until the dock presentation is ready.

The navigation bridge restores history scroll and section selection before endpoint measurement. Explicit fragment navigation is resolved as a destination state; it must not overwrite an existing history restoration. The browser/router owns URL history; the adapter owns the coordinated restoration handshake.

A transition uses retained spatial captures rather than preserving outgoing page DOM. Incoming and outgoing panel decoration/content share the moving bounds; live endpoints are masked until handoff to avoid duplicate stationary panels. Spatial element rotation interpolates a spatial pose rather than linearly blending a projective matrix. Cancellation must restore masks and release leases. Compatible superseding navigation may adopt an existing presentation; stale completion must not modify the successor.

## Rendering and interaction

One stage uses a shared WebGPU renderer/device across output bands. The pipeline draws background/hero capture, panel blur and hover feedback, rear carousel geometry below HTML panels, and foreground/minimap/shared transition content. DOM/CSS panel presentation complements GPU output. The pipeline restores borrowed renderer and object state after temporary passes.

Neighbour fades and Low/High blending operate on resolved rendered images: reducing every mesh material's opacity would expose internal surfaces. Carousel panel transforms follow the spatial composition while rear geometry remains available to the backdrop effect.

Stage-wide `renderSettings` bound the WebGPU output ratio and physical pixel area independently
of native-resolution HTML. Temporary catalog fades use the same bounded area as refinement;
blur resolves retain their internal density. Both quality target sets are warmed on initial
creation and detail-page rebinding, before motion begins. Carousel summary dimensions are
measured before per-frame writes and invalidated by resize observation. See the
[performance analysis](../performance.md) for the measurement scope and remaining costs.

Detail page input updates the live page pose; transition pose ownership is separate. Zoom coordinates hero framing, content visibility and minimap presentation. Cached targets and bounded preparation reduce work but do not eliminate device-dependent GPU cost.

The core interaction owner publishes model hover/contact state to the enclosing stage and records actual manipulation in `InteractionGuidance`. This lightweight learning state is tab-scoped (lazy browser WeakMap plus optional sessionStorage), independent of page/asset ownership and isolated from SSR requests. It suppresses repeated introductions across products and stage remounts. `ModelPointerPreview` uses the existing frame clock and stops at rest; pointer takeover preserves the visible camera pose. It never runs during transition ownership or after manual interaction.

The adapter owns help layout, non-modal popover lifecycle and reactive host messages. Its help popover lives under the stage outside the ordinary DOM layer, so model close-up cannot hide it from assistive technology. Its native-content Panel retains DOM semantics. Each stage frame commits the control DOM position first, calls the adapter's synchronous native-layout callback, measures the popover, then submits the glass surface at those same bounds. No asynchronous focus-attribute observer repositions content after the GPU submission. Closed native panels skip these layout reads. Initially hidden glass preserves authored bezel/radius values and reapplies them at the measured open size. It is returned to its owner on teardown. The 40px control uses `focusReactive="top-right"` with the summary frame as `focusAnchor`: the control and that panel's projected top-left edge follow a shared path towards the upper-right viewport edge, compensating perspective growth to keep their spacing. Panel motion, blur, fade and control travel use `getPanelFocusProgress`, ending together at 0.96 UI focus. Delayed minimap expansion reaches one at that same endpoint; its depth/position also stop changing there. The control remains at the shared minimap inset, measured from the usable viewport edge without the scrollbar. All motion reads the damped camera in the same frame without another animation loop. Automatic help can recur until real interaction; manual help remains open until dismissed. The help's timers, input/viewport observers and shared-scroll subscription are released on route teardown.

## Teardown

Unregister endpoint/DOM bindings when their owner disappears, cancel obsolete preparation results, release retained captures/instances, and dispose owner-created render targets/material clones. Keep shared source resources alive while any valid lease pins them. A controller must not dispose borrowed cached geometry or run an independent permanent animation loop. Stage disposal closes the owning runtime, rather than relying on a route DOM node to clean up GPU resources.
