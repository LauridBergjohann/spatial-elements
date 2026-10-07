# Spatial Elements

Spatial Elements brings interactive 3D models into content-driven websites. Use it to present individual items or entire collections, combining models with text, images and links in lists, carousels and detail pages.

Rendering is powered by Three.js and WebGPU. Visitors can explore models, rotate and zoom into details, and navigate between collection and detail views. Semantic HTML, links and supplied poster images remain available without WebGPU.

## Packages

| Package | Use it for |
| --- | --- |
| [@spatial-elements/sveltekit](packages/sveltekit/README.md) | Ready-to-use Svelte components, page composition and SvelteKit navigation/history integration. Includes core as a dependency. |
| [@spatial-elements/core](packages/core/README.md) | Framework-independent rendering, model loading, level of detail (LOD), camera interaction and transitions for custom integrations. |

The packages are currently in beta. The usage guides target `1.0.0-beta.3` and newer. SvelteKit is the available framework adapter; custom integrations can build on core.

## Installation

Use Node.js 22.12 or newer for tooling. In an existing Svelte / SvelteKit application (compatible peer versions: Svelte `^5.56.4`, SvelteKit `^2.70.3`):

~~~sh
npm install @spatial-elements/sveltekit@latest
~~~

For a custom integration without the SvelteKit components:

~~~sh
npm install @spatial-elements/core@latest
~~~

Three.js is a required peer dependency (`^0.186.1`). Modern npm installs it automatically. If your application imports Three.js directly, also declare it with `npm install three@^0.186.1`. Other package managers may require explicit peer installation; keep peer versions compatible rather than bypassing them with `--legacy-peer-deps`.

## Use Spatial Elements in SvelteKit

An element combines content with its 3D assets. A theme defines the shared appearance of your collection:

~~~ts
import { createSpatialTheme, type SpatialElementData } from '@spatial-elements/sveltekit';

export const theme = createSpatialTheme({ id: 'collection', name: 'My collection' });

export const elements: SpatialElementData[] = [
  {
    id: 'chair',
    title: 'Chair',
    geometry: {
      low: '/assets/chair-low.glb',
      high: '/assets/chair-high.glb'
    },
    hdr: '/assets/studio.hdr',
    fallbackImage: '/assets/chair.webp'
  }
];
~~~

Supply your own GLB models, HDR environment and optional poster images, for example in your application's `static/assets/` directory. The packages do not bundle models or environments. Both geometry variants are required and must share origin, scale and orientation. A small model can use the same URL for both; identical URLs share one cached fetch and decode.

Compose the application with these components:

1. Put `BrandStageShell` in a persistent `+layout.svelte` and pass the theme. It keeps the renderer and shared resources alive across page navigation.
2. Build a collection page with `ContentPage` and `ListSection` or `CarouselSection`. Derive list items with `getSpatialListItems(elements, '/collection/elements')` and set category lighting explicitly with `ContentPage`'s `hdr` prop.
3. Render an individual element with `SpatialElementPage`, passing its data as `spatialElement`. Add `Section` children for text, images and other content. Detail lighting comes from the element's own `hdr`.

Follow [Getting started: category and detail pages](docs/getting-started.md) for the complete layout, route files and working examples. The current transition routes use `/:namespace/categories/{list,carousel,mixed}` and `/:namespace/elements/:id` (also `products/:id`), with the theme ID as the namespace.

WebGPU rendering requires a capable browser/device and a secure context (HTTPS or localhost). Supply poster images for loading and fallback views. Asset hosting and content loading remain part of your application.

## Usage guides

- [Getting started](docs/getting-started.md): build your first collection and detail pages.
- [Authoring](docs/authoring.md): combine lists, carousels and ordinary content.
- [API reference](docs/api.md): element data, themes, components and renderer settings.
- [Interface texts and help](docs/interface-texts.md): translate controls, tooltips and the 3D interaction guide.
- [Runtime themes and ButtonGroup](docs/theming.md): host-owned light/dark preference and reusable button groups.
- [Configuration migration](docs/configuration-migration.md): update an existing beta integration.

## License and attribution

[MPL-2.0](LICENSE).

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Suggested link: [Built with Spatial Elements](https://github.com/LauridBergjohann/spatial-elements).
Dependencies retain their own licenses. The optional attribution request does not amend the license.

Working on Spatial Elements itself? See the [development guide](docs/development.md) for repository setup, the demo, checks, architecture and releases.
