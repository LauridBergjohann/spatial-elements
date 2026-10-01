# @spatial-elements/core

Framework-independent rendering and catalog runtime for Spatial Elements.

See the [authoring guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/authoring.md) and [development guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/development.md).

Beta API; MPL-2.0; see LICENSE.

Read the [getting-started tutorial](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/getting-started.md), [API reference](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/api.md) and [configuration migration](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/configuration-migration.md).

Element content and required `geometry: { low, high }` belong in `SpatialElementData`; shared appearance belongs in `SpatialTheme`. Use `createSpatialTheme({ id, name })` for defaults. The SvelteKit shell needs only the theme; pages register their own data. These docs describe the current source API, which may be newer than the published beta.

Installation:

~~~sh
npm install @spatial-elements/core@beta
~~~

Requires Node.js 22.12+ tooling.

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Three.js is a required peer dependency (^0.186.1), shared with the application and other adapters.
Modern npm installs it automatically. If the application imports Three.js directly, declare it
explicitly with `npm install three@^0.186.1`. Do not bypass incompatible peer ranges with
`--legacy-peer-deps`. Other package managers may require explicit peer installation.

Category lighting is explicit: pass `hdr="/assets/category.hdr"` to `ContentPage` (also `SpatialListPage`). It is never inferred from an element. Identical geometry URLs share one cached fetch/decode.
