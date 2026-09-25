# Package boundaries

core contains the framework-independent imperative renderer, DOM geometry/panel registrations,
asset lifecycle, LOD/refinement, camera controls, catalog identity/poses/transitions and product/theme
contracts. Browser/GPU work starts explicitly through StageExperience, never during module import.
There are no Svelte, SvelteKit, application route, brand manifest or demo asset imports in core.

sveltekit contains authoring components, Svelte contexts/lifecycle, actions requiring context and
SvelteKit preload/navigation/history integration. It imports core through package exports, never
source aliases. Three.js is a shared peer dependency of both packages; Svelte/Kit are adapter peers.
The optional SpaceMouse integration is loaded lazily from its dependency.

## Public entry points

Prefer root imports from @spatial-elements/sveltekit for BrandStageShell, ContentPage, Section,
ListSection, CarouselSection, ProductDetailPage, Panel, Stage and StageViewport. ProductOverviewPage
is retained for compatibility. Root exports include product types, lookup/projection helpers and
catalogViewLink. ScrollNavigationBridge is available for custom integration/test shells.

@spatial-elements/core exposes StageExperience, ProductAssetManager, GltfProductAssetLoader,
product/theme/asset contracts, lookup/projection helpers and catalogViewLink. Explicit stage/*,
catalog/* and product-detail/* subpath families allow the adapter and advanced integration tests
to share the same module instances. Treat these lower-level APIs as version-coupled during 0.x;
core and sveltekit must be released together. No Svelte files are exported by core.

Builds use tsc and @sveltejs/package. Source maps/declarations are included. Test fixtures, apps,
GLBs, HDRs and posters are excluded from npm tarballs. A boundary check prevents application aliases
and framework imports from entering core. Packed consumer verification uses a fresh OS temporary
directory, installs real tarballs and peers, and checks types, SSR compilation and production build.

References: [Svelte packaging](https://svelte.dev/docs/kit/packaging),
[npm workspaces](https://docs.npmjs.com/cli/v11/using-npm/workspaces/).
