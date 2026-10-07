# @spatial-elements/sveltekit

SvelteKit components and navigation for Spatial Elements.

Pass a reactive `theme` and optional resolved `colorScheme` (`light` or `dark`) to `BrandStageShell` for live appearance changes. The host owns system preference and persistence. The public `ButtonGroup` component can implement a theme switch, language selector or other choices. See [runtime themes and ButtonGroup](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/theming.md).

Detail pages include 3D help and a detail/fullscreen view switch, with a viewport fallback when native fullscreen is unavailable. Pass optional `messages` to `BrandStageShell` to translate labels, tooltips and instructions, including `controls.detailView` and `controls.fullscreen`; missing strings use English defaults. See [interface texts and help](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/interface-texts.md) for the complete typed dictionary and examples.

The detail button always restores the fitted camera view, including when already on the detail page. Its selected background fades with camera zoom; the fullscreen button remains selected throughout fullscreen navigation.

See the [authoring guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/authoring.md) and [development guide](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/development.md).

Beta API; MPL-2.0; see LICENSE.

Read the [getting-started tutorial](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/getting-started.md), [API reference](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/api.md) and [configuration migration](https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/configuration-migration.md).

Element content and required `geometry: { low, high }` belong in `SpatialElementData`; shared appearance belongs in `SpatialTheme`. Use `createSpatialTheme({ id, name })` for defaults. The SvelteKit shell needs only the theme; pages register their own data. These docs target version `1.0.0-beta.3` and newer.

Installation:

~~~sh
npm install @spatial-elements/sveltekit@latest
~~~

Requires Node.js 22.12+ tooling. Use in an existing Svelte 5 / SvelteKit 2 application.

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Three.js is a required peer dependency (^0.186.1), shared with the application and other adapters.
Modern npm installs it automatically. If the application imports Three.js directly, declare it
explicitly with `npm install three@^0.186.1`. Do not bypass incompatible peer ranges with
`--legacy-peer-deps`. Other package managers may require explicit peer installation.

Category lighting is explicit: pass `hdr="/assets/category.hdr"` to `ContentPage` (also `SpatialListPage`). It is never inferred from an element. Identical geometry URLs share one cached fetch/decode.
