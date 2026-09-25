# Runtime scenarios and ownership

## Prepared navigation

~~~mermaid
sequenceDiagram
  participant User
  participant Adapter as SvelteKit adapter
  participant Prepare as CatalogPreparation
  participant Runtime as Stage runtime
  User->>Adapter: Hover/focus or activate product link
  Adapter->>Prepare: Request optional assets and preparation
  Prepare->>Runtime: Decode, instantiate and warm when gate allows
  User->>Adapter: Navigate
  Adapter->>Runtime: Capture source presentation and retain resources
  Adapter->>Adapter: Resolve route data, mount, restore scroll/selection
  Adapter->>Runtime: Measure and bind destination
  Runtime->>Runtime: Freeze readiness and start motion clock
  Runtime->>Runtime: Animate shared pose and independent reveal channels
  Prepare-->>Runtime: Late readiness, if needed
  Runtime->>Runtime: Refine after motion; hand off and release captures
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

Endpoints match semantic brand/product/role and then a concrete slot/occurrence. Multiple lists and carousels can contain the same product. Carousel neighbours and partially visible products can participate; absence of a valid drawable source/destination falls back to ordinary navigation. During intermediate PDP docking the hero remains the source until the dock presentation is ready.

The navigation bridge restores history scroll and section selection before endpoint measurement. Explicit fragment navigation is resolved as a destination state; it must not overwrite an existing history restoration. The browser/router owns URL history; the adapter owns the coordinated restoration handshake.

A transition uses retained spatial captures rather than preserving outgoing page DOM. Incoming and outgoing panel decoration/content share the moving bounds; live endpoints are masked until handoff to avoid duplicate stationary panels. Product rotation interpolates a spatial pose rather than linearly blending a projective matrix. Cancellation must restore masks and release leases. Compatible superseding navigation may adopt an existing presentation; stale completion must not modify the successor.

## Rendering and interaction

One stage uses a shared WebGPU renderer/device across output bands. The pipeline draws background/hero capture, panel blur and hover feedback, rear carousel geometry below HTML panels, and foreground/minimap/shared transition content. DOM/CSS panel presentation complements GPU output. The pipeline restores borrowed renderer and object state after temporary passes.

Neighbour fades and Low/High blending operate on resolved rendered images: reducing every mesh material's opacity would expose internal surfaces. Carousel panel transforms follow the spatial composition while rear geometry remains available to the backdrop effect.

PDP input updates the live page pose; transition pose ownership is separate. Zoom coordinates hero framing, content visibility and minimap presentation. Cached targets and bounded preparation reduce work but do not eliminate device-dependent GPU cost.

## Teardown

Unregister endpoint/DOM bindings when their owner disappears, cancel obsolete preparation results, release retained captures/instances, and dispose owner-created render targets/material clones. Keep shared source resources alive while any valid lease pins them. A controller must not dispose borrowed cached geometry or run an independent permanent animation loop. Stage disposal closes the owning runtime, rather than relying on a route DOM node to clean up GPU resources.
