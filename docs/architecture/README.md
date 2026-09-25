# Spatial Elements architecture

Current implementation baseline: 2026-09-25, extracted packages at e22aa02. This is implementation documentation, not a proposal for an additional rewrite.
The twelve sections follow [arc42](https://arc42.org/overview/); the diagrams use the context, container and component levels of [C4](https://c4model.com/diagrams). Diagram arrows describe dependencies or data flow, not deployment of npm packages as services.

## 1. Introduction and goals

Spatial Elements combines accessible HTML content with interactive product geometry, panels and continuity between catalog presentations. Content authors compose Section, ListSection and CarouselSection inside ContentPage; ProductDetailPage supplies detail interaction. Goals are immediate usable content, smooth prepared transitions, stable navigation/history, bounded resource use and reusable framework-independent rendering.

## 2. Constraints

The current adapter targets Svelte 5 and SvelteKit. Three.js supplies WebGPU rendering; browser GPU initialization is client-only. SSR delivers HTML and posters. Core does not import Svelte or SvelteKit. Navigation currently recognizes same-brand catalog/product route conventions described in [authoring](../authoring.md). Packages are pre-release and not published. MPL-2.0 covers project code; asset redistribution rights are separate.

## 3. Context and scope - C4 level 1

~~~mermaid
flowchart LR
  Visitor[Visitor] -->|Browse, scroll, drag, navigate| Catalog[Host catalog application using Spatial Elements]
  Author[Developer or content author] -->|Product contracts, themes and sections| Catalog
  Catalog -->|Optional route data requests| Data[Host-owned product API or CMS]
  Catalog -->|Read models, posters and environments| Assets[Host-owned asset storage]
~~~

Spatial Elements is a library inside the host application. It does not provide a CMS, product database, commerce backend or hosting service.

## 4. Solution strategy

Keep semantic content in HTML, render spatial geometry through a persistent stage, and let SvelteKit own URLs/history. Identify shared elements by product and role instead of retaining page DOM. Prepare optional resources ahead of motion; pin captured presentations across route replacement. Use a common Low/High coordinate frame and resolved-image fades. Separate public neutral examples from private integration assets.

## 5. Building blocks - C4 levels 2 and 3

### Host deployment containers

~~~mermaid
flowchart TB
  subgraph Browser[Browser application - JavaScript, DOM and WebGPU]
    UI[Svelte components and navigation adapter]
    Core[Core runtime and Three.js]
    UI -->|Bindings, intent and lifecycle| Core
    Core -->|Rendered canvas output| UI
  end
  Browser -->|Navigation and route data over HTTP| Server[SvelteKit host server - SSR and load]
  Server -->|Optional application data| API[Host API or CMS]
  Browser -->|GLB, decoder, HDR and poster requests| Storage[Static host or CDN]
~~~

The host chooses its SvelteKit deployment adapter. No separate Spatial Elements server is required. In a prerendered host, static delivery can replace applicable server routes. npm packages are build-time modules inside the browser/server bundles, not C4 containers.

### Browser runtime components

~~~mermaid
flowchart TB
  Components[ContentPage, sections and ProductDetailPage] --> Adapter[Stage and ScrollNavigationBridge]
  Adapter --> Registry[Endpoint registry and transition coordinator]
  Adapter --> Experience[StageExperience]
  Experience --> Binding[PageBindingController]
  Experience --> Presentation[ProductPresentationController]
  Experience --> Interaction[ProductInteractionController]
  Experience --> Minimap[MinimapController]
  Experience --> Panels[PanelPresentationController]
  Experience --> Pipeline[StageRenderPipeline]
  Experience --> Catalog[CatalogProductLayer and retained captures]
  Presentation --> Assets[ProductAssetManager and environment cache]
  Registry --> Preparation[CatalogPreparation and PreparationGate]
  Preparation --> Assets
~~~

StageExperience owns runtime orchestration. Controllers separate DOM measurement, product representations, input, minimap and panels. StageRenderPipeline owns render passes/targets and renderer-state restoration, not navigation. Endpoint registrations describe live presentations; asset leases and retained captures have separate lifetimes.

Code entry points: [StageExperience](../../packages/core/src/stage/StageExperience.ts), [pipeline](../../packages/core/src/stage/StageRenderPipeline.ts), [endpoint registry](../../packages/core/src/catalog/CatalogEndpointRegistry.ts), [navigation bridge](../../packages/sveltekit/src/catalog/ScrollNavigationBridge.svelte). See [package boundaries](../package-boundaries.md) for supported entry points.

## 6. Runtime view

[Runtime scenarios](runtime.md) document cold entry, prepared navigation, history restoration, drawing and disposal. A successful download is not proof of GPU readiness. Required route content precedes measurement; optional High geometry and background refine independently.

## 7. Deployment view

The public monorepo builds core and sveltekit packages and a neutral demonstration app. The private examples application consumes those packages via sibling links during development or real tarballs for release-style checks. A single compatible Three.js/Svelte installation avoids duplicate runtime instances. Assets remain host-owned and must be served at configured URLs; decoder URLs must also resolve in deployment. No private brand assets belong in npm tarballs. See [development](../development.md) and [release](../release.md).

## 8. Cross-cutting concepts

- Semantic identity is brand + product + role; occurrence and slot select a concrete presentation on a mixed page. Low/High are representations, not different products.
- One navigation restoration owner reconciles native/virtual scroll before endpoint measurement; selection belongs to the corresponding history entry.
- Persistent stage ownership outlives page DOM. Generation/revision checks reject stale asynchronous completion and cleanup.
- Retained captures pin resources until handoff/cancel; caches own reusable decoded data. [Asset contract](assets.md).
- Reduced motion, unavailable GPU and missing endpoints preserve navigation and usable HTML/posters.
- Themes belong to brand configuration; product content and physical geometry metadata belong to products.

## 9. Architecture decisions

See [accepted decisions](decisions.md), including the change from exclusive page views to composable sections. Future adapters are an extension point, not an implemented portability guarantee.

## 10. Quality requirements

| Scenario | Required response | Evidence location |
| --- | --- | --- |
| Back/forward after scroll or carousel selection | Restore destination state before matching and measuring | Private history/browser suites |
| High representation unavailable | Low/poster remains usable; optional refinement follows readiness | Preparation tests and demo browser cases |
| Navigation interrupts a transition | Release or explicitly transfer ownership; reject stale completion | Core lifecycle tests and private interruption suites |
| Repeated catalog/detail journeys | Bounded residency; no orphan DOM bindings or idle render loop | Asset/pipeline unit tests and private runtime suite |
| Consumer installed from tarballs | SSR imports, declarations and production build work outside the monorepo | Public verification script and CI |
| Unsupported GPU or JavaScript disabled | Product content and navigation remain usable | Public fallback browser cases |

Historical device acceptance and zoom measurements remain private. They are not a guarantee of 60 fps on every device.

## 11. Risks and technical debt

Cold GPU/decoder initialization can still cause latency; the preparation gate cannot preempt work already executing. Driver allocations and transient GPU memory are not fully represented by application counters. Heavy geometry, blur and high pixel counts remain device-dependent costs. Route conventions and advanced internal subpaths are not yet stable universal APIs. Real-brand diagnostics are private and hardware-dependent; public CI does not replace them. Release dependency/toolchain considerations are tracked in [release](../release.md).

## 12. Glossary

| Term | Meaning |
| --- | --- |
| Stage | Persistent rendering/integration owner for spatial content |
| Endpoint | Registered measurable presentation of a semantic product role |
| Slot / occurrence | Where and which instance of a product is presented |
| Prepared | Ready to draw, including required GPU work, not just downloaded |
| Low / High | Lightweight and detailed representations in one coordinate frame |
| Capture / lease | Retained presentation / explicit claim keeping its resources alive |
| PLP / PDP | Product listing presentation / product detail page |
