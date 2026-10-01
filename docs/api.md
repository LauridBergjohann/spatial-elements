# Configuration and component reference

For a runnable category/detail setup, begin with [Getting started](getting-started.md). This reference describes the current source API; see [migration](configuration-migration.md) when updating an older beta.

## Ownership: which setting belongs where?

| Owner | Purpose | Defined in |
| --- | --- | --- |
| SpatialElementData | One element's content, model, lighting and detail presentation | Application data / CMS, consumed by page load functions |
| SpatialTheme | Shared brand identity, colors and panel materials | Persistent layout, usually via createSpatialTheme |
| BrandStageShell | Renderer lifetime, GPU budget and decoder infrastructure | Persistent +layout.svelte |
| ContentPageData | Category title, introduction and breadcrumbs | Category +page.svelte or its load data |
| SpatialListItem | Derived link, summary and assets for an element occurrence | getSpatialListItems(elements, basePath) |
| Section definition | Anchor, heading and optional local CSS overrides | Content/detail page |

There is no separate SpatialStageConfig document. The adapter derives its internal renderer scene from the active page. You do not need a layout-level catalog, an active element ID, or a duplicate list of models.

## Element data

All fields are flat. See [SpatialElementData TSDoc](../packages/core/src/spatial-element/types.ts).

| Field | Required/default | Meaning |
| --- | --- | --- |
| id | Required | Stable identity within the theme namespace; use URL-safe IDs. |
| title | Required | Visible title and default document title. |
| geometry | Required | Both low and high: model URL strings, or versioned resource descriptors from an asset pipeline. Low for categories/transitions; High for detail. Same URLs share a cached fetch/decode. |
| hdr | Required | Detail lighting and background HDR. Category lighting is set independently on ContentPage.hdr. |
| brandId | Inherited from shell | Optional assertion: must equal theme.id when supplied. |
| pageTitle | title | Browser document title. |
| eyebrow | Empty | Short series/category label. |
| features | [] | Summary entries: { label, marker? }. |
| action | Absent | { label, href?, ariaLabel?, semanticId? }. With href renders a link; without it renders a button. The host owns business behavior. |
| background | { blurriness: 0.2, tint: '#b6deff', tintIntensity: 0.3 } | HDR background presentation; independent of model lighting and theme.background. Supply the full settings object when overriding. |
| model | Imported pose/materials | Optional rotation {x,y,z} in radians, excludeMeshes (exact mesh names), materialOverrides (physical material settings keyed by mesh name). Excluded context meshes remain visible on the main stage but do not determine fit, picking, outlines or minimaps. |
| camera | Automatic fit | azimuth/elevation in degrees, fitPadding in CSS pixels, fitScale as a multiplier. |
| fallbackImage | Absent | Poster URL for loading, SSR and unavailable WebGPU. Recommended. |
| fallbackImageSize | Absent | Actual poster pixel dimensions [width,height], not physical model dimensions. |
| breadcrumbs | [] | { label, href? }; entries without href are plain text. |
| media | One minimap | Entries with id, kind and label; kinds minimap, drawing, image. Images also require src and alt. [] removes entries. |
| minimap | Runtime fit defaults | Per-element inset, modelScale, hoverModelScale, expandedHoverModelScale and dockedView. Shared colors belong in the theme. |
| assetManifest | Absent | Advanced verified resource manifest. Not needed for a simple GLB. |

Category pages require an explicit ContentPage.hdr. No element supplies or overrides the category environment, including the first element. Detail pages use the selected element's hdr.

An action without href does not install a click handler automatically. Use ordinary links or application-owned controls in Section children for custom application behavior. Theme and content options do not perform purchases, fetch content or own routing.

[Model/camera/minimap types](../packages/core/src/stage/stageTypes.ts) document units and supported material properties. [LOD and resource ownership](architecture/assets.md) explain the advanced asset contract.

## Geometry details

~~~ts
geometry: { low: '/assets/chair-low.glb', high: '/assets/chair-high.glb' }
// A tiny model can serve both roles, with one cached fetch and decode:
geometry: { low: '/assets/cube.glb', high: '/assets/cube.glb' }
~~~

Both roles are mandatory. URLs identify resources independently of the Low/High role. Sharing a file does not produce an optimized version automatically. Distinct exports must share origin, axes and scale; there is no automatic alignment or decimation. Without generated metadata, Low bounds determine the shared model fit.

Advanced pipelines can provide resource objects {url, format, revision, requirements?} instead of strings, plus geometry.assetToFrame, bounds, revision and status. For the same URL, resource metadata must agree; contradictory versions are rejected instead of downloading the same URL twice. Version changing content with a URL or resource revision. geometryFromLodPair converts existing generated pair metadata without carrying its redundant sourceUrl into authored element data. See [geometry TSDoc](../packages/core/src/spatial-element/spatialElementGeometry.ts).

## Shared theme

Use createSpatialTheme({ id, name, ...overrides }). Only id and name are required; each appearance group merges field-by-field with defaults. Every call returns independent objects. Existing complete SpatialTheme objects remain valid.

| Group | Purpose and helper defaults |
| --- | --- |
| id / name | Namespace matching the route prefix / accessible brand name. |
| background | Flat page color: #eef1f4. This is not the HDR background. |
| colors | ink #173047, body #263c4d, accent #285c89, onAccent #ffffff, tabBackground #e4ebf1. |
| panelShape | radius 16 and contentInset 26, both in CSS pixels. |
| panelTheme | surface frosted, tint #ffffff, tintOpacity 0.65, backdropBlur 8px, shadowIntensity 0.2, opacity 1. Further glass controls use runtime defaults. |
| dockedPanelTheme | Compact header/tabs: tint #ffffff, tintOpacity 0.92, backdropBlur 5px, shadowIntensity 0.2. |
| sectionTheme | Ordinary HTML sections: tint #ffffff, tintOpacity 0.8, backdropBlur 8px. |
| minimapTheme | expandedHeight 240px, overlayColor #000000, overlayOpacity 0.35, overlayBlur 5px, contextOpacity 0, viewportColor from accent. |
| interactionTheme | outlineColor from accent; other picking/outline controls use runtime defaults. |

Color overrides do not modify GLB materials. Use element.model.materialOverrides for that. Opacity and tint strengths use 0..1. Panel surfaces are solid (CSS), frosted (CSS backdrop blur) and glass (GPU refraction). Glass can cost more GPU work; the helper chooses frosted.

See [createSpatialTheme](../packages/core/src/spatial-element/spatialTheme.ts), [theme types](../packages/core/src/spatial-element/types.ts), [panel controls](../packages/core/src/stage/panelContext.ts) and [renderer controls](../packages/core/src/stage/stageTypes.ts) for all fields.

## Svelte components

| Component | Props and responsibility |
| --- | --- |
| BrandStageShell | Required theme; optional renderSettings, dracoDecoderPath and children. Persistent layout and renderer owner. No stage/catalog props. |
| ContentPage | Required hdr: environment URL and page: ContentPageData; optional children. Registers a category/content page. page.title is required; pageTitle defaults to title, eyebrow/intro/breadcrumbs are optional. |
| ListSection | Required section: {id,title,style?}, list: SpatialListItem[]. Registers its own element occurrences. |
| CarouselSection | Same section/list; optional presentation: {radius?,depth?}, initialItemKey, onselectionchange({itemKey,spatialElementId}). Radius defaults to 0.48 of section width (clamped 0.2..0.7); depth defaults to 700 CSS-world pixels (clamped 0..1200). |
| SpatialListPage | Convenience wrapper: ContentPageData fields directly as props, required hdr and spatialElements, optional sectionLink: {href,label}. For new composable pages prefer ContentPage with sections. |
| SpatialElementPage | Required spatialElement: SpatialElementData; optional children. Owns detail content, model selection and generated section navigation. |
| Section | Required section: {id,title,style?}; optional children and HTML attributes/class. The presentation prop is used by spatial list/carousel wrappers. Detail sections automatically populate tabs. |

Mount one active ContentPage or SpatialElementPage under each shell. Sections are children of that page; they are not independent pages. Section IDs must be stable, unique and start with a lowercase letter, followed by lowercase letters, digits or hyphens. Section style accepts tint, tintOpacity, backdropBlur, textColor and CSS width (for example 72rem).

getSpatialListItems(elements, basePath) derives links and includes summary and flat assets automatically. List entries can customize summary.sectionLink to point at an authored detail section. Use itemKey to distinguish repeated copies of the same element within one section; internal pose/occurrence fields are assigned by the adapter. findSpatialElement(elements, id) returns the matching document or undefined; the host decides how to render a 404.

Keep ordinary anchor links and supply all required data through route load functions. Current transition route patterns and deployment requirements are documented in [Getting started](getting-started.md).

## Renderer infrastructure

BrandStageShell.renderSettings accepts maxPixelRatio (default 1) and maxPixels (default 2,073,600). The tighter budget wins. maxPixels: null disables the area limit; invalid/nonpositive numeric values fall back to defaults. DOM text retains native resolution. Budget settings are applied at renderer creation and page binding; they are not an animation control. See [performance](performance.md).

BrandStageShell.dracoDecoderPath is the directory of host-served Draco decoder files, with trailing slash. Default: /assets/draco/gltf/. Models and decoders are not application static assets installed automatically by the package. Meshopt uses the Three.js decoder dependency.

Stage, Panel, StageViewport and StageExperience are lower-level building blocks for custom integrations. Stage's low-level standalone glb/hdr/model/background/camera options configure a manually composed scene; they do not need to be repeated when using BrandStageShell and page components. Manual Stage.catalog / CatalogPage is retained as a legacy adapter contract. New SvelteKit consumers should use page registration through the high-level components. Internal SpatialElementScene is a renderer projection, not a third authoring document.
