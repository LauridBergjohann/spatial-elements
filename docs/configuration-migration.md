# Configuration API migration

Version `1.0.0-beta.3` introduces this breaking authoring API change. Upgrade core and the SvelteKit adapter together. The older [SpatialElement migration](spatial-element-migration.md) describes the preceding naming change.

| Previous API | Current API |
| --- | --- |
| `SpatialStageConfig` | Removed; model and environment fields live on `SpatialElementData`. |
| `element.stage.glb` / `element.glb` and optional `lodPair` | Required `element.geometry: { low, high }`. For an existing single file use the same URL twice. Convert generated pairs with `geometryFromLodPair(pair)`. |
| `element.stage.hdr`, `background`, `model`, etc. | Flat `element.hdr`, `background`, `model`, `camera`, `assetManifest`, `fallbackImage`, `fallbackImageSize`. |
| Category HDR from layout or first element | Required `hdr` prop on `ContentPage` / `SpatialListPage`. Selection and order no longer affect lighting. |
| `<BrandStageShell {theme} {stage} {catalog}>` | `<BrandStageShell {theme}>`. Pages register themselves. |
| `stage.dracoDecoderPath` | `dracoDecoderPath` prop on the shell; this is renderer infrastructure, not element content. |
| `getSpatialListItems(elements, path, { includeStage: true })` | `getSpatialListItems(elements, path)`; assets and summaries are always projected when present. |
| `item.stage.fallbackImage` | `item.fallbackImage`; list items carry geometry and the other asset fields too. |
| Complete handwritten `SpatialTheme` | Still supported; `createSpatialTheme({ id, name, ...overrides })` now supplies defaults. |
| Required element brand ID, page title, features, action, breadcrumbs and media | Optional. Brand comes from the shell, page title from title, arrays default empty except media (one minimap), omitted action renders no button. |

Move per-element values from the old stage object onto the element, grouping Low/High URLs under geometry. Remove top-level glb and lodPair. Shared application-owned element defaults can still use object spread; do not put model data back in the layout. Explicit element `brandId`, when supplied, must match the theme ID.

Remove active-element lookups and catalog construction from layouts. Keep route data in `+page.ts`/`+page.server.ts` and consume it in `+page.svelte`. Every category page uses `ContentPage`, every detail page uses `SpatialElementPage`, all under a persistent `BrandStageShell`.

Low-level `Stage` and core `StageExperience` remain available for custom adapters; their scene options are not an additional authoring document. Manual `Stage.catalog` is a legacy integration path and is unnecessary with the shell. Render budgets, LOD resource ownership, navigation/history and preparation policies remain unchanged.

The public demo and all three private brand examples have been migrated. Follow the executable [getting-started guide](getting-started.md) for a minimal setup and the [API reference](api.md) for defaults.
