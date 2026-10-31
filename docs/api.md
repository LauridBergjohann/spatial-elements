# Configuration and component reference

For a runnable category/detail setup, begin with [Getting started](getting-started.md). This reference describes the current source API; see [configuration migration](configuration-migration.md) and [layout migration](layout-migration.md) when updating an older beta.

## Ownership: which setting belongs where?

| Owner | Purpose | Defined in |
| --- | --- | --- |
| SpatialElementData | One element's content, model, lighting and detail presentation | Application data / CMS, consumed by page load functions |
| SpatialTheme | Shared brand identity, colors and panel materials | Persistent layout, usually via createSpatialTheme |
| BrandStageShell | Renderer lifetime, interface translations, GPU budget and decoder infrastructure | Persistent +layout.svelte |
| ContentPageData | Category title, introduction and breadcrumbs | Category +page.svelte or its load data |
| SpatialListItem | Derived link, summary and assets for an element occurrence | getSpatialListItems(elements, basePath) |
| Section definition | Anchor/navigation label, optional visible headline, background and local CSS overrides | Content/detail page |

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
| media | One minimap | Entries with `id`, `kind` and `label`; kinds `minimap`, `image`, `video`, `youtube`. Detail pages always place one 3D/minimap entry first, including when `media: []` is supplied. See [media and input](design/layout/media-and-input.md) for fields and lifecycle. The old source-less `drawing` entry is deprecated; replace it with an image. |
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

Themes can change at runtime. Pass the selected `theme` and optional resolved `colorScheme="light"` or `"dark"` to `BrandStageShell`. Optional `theme.sceneBackground` overrides the visible HDR backdrop without changing model lighting. The host owns preference, storage and system detection. See [Runtime themes and ButtonGroup](theming.md) for complete examples and the generic `ButtonGroup` API.

Use createSpatialTheme({ id, name, ...overrides }). Only id and name are required; each appearance group merges field-by-field with defaults. Every call returns independent objects. Existing complete SpatialTheme objects remain valid.

| Group | Purpose and helper defaults |
| --- | --- |
| id / name | Namespace matching the route prefix / accessible brand name. |
| background | Flat page color: #eef1f4. This is not the HDR background. |
| sceneBackground | Optional partial overrides for the element's HDR backdrop: blurriness, tint, tintIntensity. Leaves model lighting unchanged. |
| colors | ink #173047, body #263c4d, accent #285c89, onAccent #ffffff, tabBackground #e4ebf1. |
| panelShape | radius 16 and contentInset 26, both in CSS pixels. |
| radii | control 12px for cards/small controls; panel 16px for panels/detached section groups. An explicitly authored panelShape.radius is the compatibility fallback for both roles; explicit radii fields win. |
| sectionBackgrounds | standard #ffffff and muted #f5f7f9, independent of glass/frosted panel material colors. |
| panelTheme | surface frosted, tint #ffffff, tintOpacity 0.65, backdropBlur 8px, shadowIntensity 0.2, opacity 1. Further glass controls use runtime defaults. |
| dockedPanelTheme | Compact header/tabs: tint #ffffff, tintOpacity 0.92, backdropBlur 5px, shadowIntensity 0.2. |
| sectionTheme | Legacy section material: tint #ffffff, tintOpacity 0.8, backdropBlur 8px. New section.background roles use sectionBackgrounds instead. |
| minimapTheme | expandedHeight 240px, overlayColor #000000, overlayOpacity 0.35, overlayBlur 5px, contextOpacity 0, viewportColor from accent. |
| interactionTheme | outlineColor from accent; other picking/outline controls use runtime defaults. |

Color overrides do not modify GLB materials. Use element.model.materialOverrides for that. Opacity and tint strengths use 0..1. Panel surfaces are solid (CSS), frosted (CSS backdrop blur) and glass (GPU refraction). Glass can cost more GPU work; the helper chooses frosted.

`radii` and `sectionBackgrounds` are optional on older manually constructed SpatialTheme objects;
the factory resolves both groups. Radius values are finite, nonnegative CSS pixels: negative values
clamp to zero and nonfinite values use the resolved fallback. A radius does not change contentInset.

See [createSpatialTheme](../packages/core/src/spatial-element/spatialTheme.ts), [theme types](../packages/core/src/spatial-element/types.ts), [panel controls](../packages/core/src/stage/panelContext.ts) and [renderer controls](../packages/core/src/stage/stageTypes.ts) for all fields.

Interface language is independent of the theme. Pass `messages: SpatialMessagesInput` to `BrandStageShell` to override control labels, accessible names, tooltips and 3D-help instructions. Missing keys use English defaults. See [interface texts and help](interface-texts.md) for all keys and a complete translation example.

## Svelte components

| Component | Props and responsibility |
| --- | --- |
| BrandStageShell | Required reactive theme; optional colorScheme (light/dark), messages, renderSettings, dracoDecoderPath, deviceOrientation (default false, for detail geometry/minimap), menu, left/right satellite snippets, summary: SpatialSummarySnippet, and children. Persistent layout and renderer owner. No stage/catalog props. |
| ButtonGroup | Required items, label and shape; controlled value/onchange, optional theme, iconOnly and content snippet. Generic panel-backed choices owned by the host. |
| ContentPage | Required hdr: environment URL and page: ContentPageData; optional background: CSS color and children. background overrides the flat page color for this page in DOM and enhanced rendering, without changing HDR lighting or the shared theme. page.title is required; pageTitle defaults to title, eyebrow/intro/breadcrumbs are optional. |
| ListSection | Required section: {id,title,headline?,background?,style?}, list: SpatialListItem[]. Optional cardSize: s/m/l (default m), textAlign: start/center (default start). Registers its own element occurrences. |
| CarouselSection | Same section/list; optional presentation: {radius?,depth?}, initialItemKey, onselectionchange({itemKey,spatialElementId}). Radius controls model spacing, normalized around 0.48 (clamped 0.2..0.7); depth defaults to 700 CSS-world pixels (clamped 0..1200). The selected media fit and summary placement follow the shared responsive layout. Visibility follows the viewport, including space outside a centered section. |
| SpatialListPage | Convenience wrapper: ContentPageData fields directly as props, required hdr and spatialElements, optional sectionLink: {href,label}. For new composable pages prefer ContentPage with sections. |
| SpatialElementPage | Required spatialElement: SpatialElementData; optional children. Owns detail content, model selection and generated section navigation. |
| Section | Required section: {id,title,headline?,background?,style?}; optional children and HTML attributes/class. The presentation prop is used by spatial list/carousel wrappers. Detail sections automatically populate tabs. |
| ContentGrid | Optional children and HTML attributes/class. Places explicit ContentBlock children on the enclosing section's content grid; adds no outer padding. |
| ContentBlock | Optional span: number or {xs?,s?,m?,l?}, children and HTML attributes/class. Fills the row by default; responsive spans inherit mobile-first. |

Mount one active ContentPage or SpatialElementPage under each shell. Sections are children of that page; they are not independent pages. Section IDs must be stable, unique and start with a lowercase letter, followed by lowercase letters, digits or hyphens.

### Carousel layout and summary content

Carousel sections use the ordinary content grid, heading gap and background rules. The selected
media fit is a framing target, not a clipping boundary for neighbouring geometry. XS/S reserve
a 66px title strip and show only the framework's title, optional eyebrow and detail arrow;
without an eyebrow the 40px title block aligns to the bottom of that same strip. From M, the
full summary has the matching detail-panel width and centers vertically in the fit area. Its
height is intrinsic, capped at the fit height with local scrolling. The 3XL carousel keeps the
2XL composition and 480px panel width.

Define optional `BrandStageShell.summary` in the persistent brand layout. The exported
`SpatialSummarySnippet` receives a `SpatialSummaryContext` containing common resolved
`spatialElement` fields, `mode: 'detail' | 'carousel'`, `heading`, `contentInset` and catalog
endpoint addresses. The default summary remains available when the snippet is omitted. Each
summary has an inline-size query container named `spatial-summary`; use container queries for
host-defined one-, two- or three-column content. Initial output must be synchronous and
content-only; await required data in route load, and keep `svelte:head` outside the summary.

The adapter distinguishes occurrences by section and `itemKey`. A product shown in two sections
has two independent live summary instances. Carousel selection and responsive changes retain
each occurrence's interactive state. Route-transfer activation belongs to the transition
coordinator; matching a product ID alone is not sufficient to adopt another occurrence.
See [summary rendering and ownership](design/layout/summary-snippets.md) for the precise lifecycle
and SSR boundaries.

### Section headings and surfaces

`section.title` names the section in generated navigation and for accessibility. Only optional
`section.headline` renders a visible heading. Omitting it also removes its heading gap; the section
keeps an accessible label. Set `headline: title` explicitly when retaining an old visible heading.

`section.background` is `{ color, size? }`; omitted backgrounds resolve to transparent/standard.
Color values are `transparent`, `standard`, `muted`, `transparentToStandard`, `transparentToMuted`,
`standardToTransparent`, `standardToMuted`, `mutedToTransparent` and `mutedToStandard`.
Size is `standard` (default, the padded grid width) or `full` (viewport-width background with the
same content grid). Gradients run from top to bottom and require effective `full` size. Detail pages
constrain every background to `standard`. A gradient that is not effectively full becomes its end
color and emits a development diagnostic once per offending configuration/context.

Detached, adjacent opaque standard-width sections share outer panel-radius corners on wide layouts;
transparent and full-width sections break the group. Different standard/muted colors do not break it.
The 3XL detail ContentPane owns its outer corners instead of rounding its individual sections.

Legacy `section.style` still accepts tint, tintOpacity, backdropBlur, textColor and CSS width. Keep
explicit legacy material settings when migrating a custom surface; do not add a new background role
on top of them and expect both material systems to apply. Prefer the new grid/container contract to
independent section widths, and retain textColor only as an orthogonal text override.

### Content grid and cards

Grid classification uses the content container width before section padding, capped at 1536px.
It is independent of viewport classification. Section owns one outer padding on each side;
ContentGrid uses the same token for its inter-block gap.

| Container width | Grid | Columns | Padding/gap | Headline size/line height | Body size/line height |
| --- | --- | --- | --- | --- | --- |
| Below 600px | xs | 4 | 12px | 18px/28px | 14px/20px |
| 600px to below 840px | s | 6 | 16px | 18px/28px | 14px/20px |
| 840px to below 1200px | m | 8 | 16px | 20px/32px | 14px/20px |
| 1200px to 1536px | l | 12 | 24px | 24px/40px | 16px/24px |

ContentBlock span values are positive integers. A single number applies at every grid size.
Responsive values inherit the last supplied smaller size; before the first supplied value they fill
the row. Invalid values fall back to the full row and excessive spans clamp to available columns,
with development diagnostics. Placement follows DOM order without dense backfilling. Ordinary
Section children remain ordinary content unless wrapped in ContentGrid/ContentBlock.

| Card size | Column span | Title size/line height | Eyebrow size | Title rows without/with eyebrow |
| --- | --- | --- | --- | --- |
| s | 1 | 9px/18px | Hidden | 1 / n/a |
| m | 2 | 12px/20px | 10px | 2 / 1 |
| l | 4; 3 in grid s | 18px/24px | 14px | 3 / 2 |

Titles use weight 500; eyebrows use weight 400 and share the title line height. Empty eyebrows
consume no line. Cards are square; posters and models fit the same 4:3 slot, shrinking the slot
on narrow cards to retain the text budget. Full title text remains accessible through the real
detail link and tooltip. See [authoring](authoring.md) for examples and [layout migration](layout-migration.md)
for appearance and sizing changes.

getSpatialListItems(elements, basePath) derives links and includes summary and flat assets automatically. List entries can customize summary.sectionLink to point at an authored detail section. Use itemKey to distinguish repeated copies of the same element within one section; internal pose/occurrence fields are assigned by the adapter. findSpatialElement(elements, id) returns the matching document or undefined; the host decides how to render a 404.

Keep ordinary anchor links and supply all required data through route load functions. Current transition route patterns and deployment requirements are documented in [Getting started](getting-started.md).

`SpatialListItem.targetPresentation: 'dock'` and `summary.sectionLink.targetPresentation: 'dock'`
declare that a fragment destination opens the completely docked content view. This optional
contract allows its endpoint to be resolved before route mounting; arbitrary fragments still
use the ordinary restored-destination path. Native document limits remain authoritative. In
3XL the model stays on the fixed left stage and the pane header is the corresponding endpoint.
See [known detail endpoints](design/layout/staged-detail-endpoints.md).

The source-first transition currently requires `?stagedNavigation=1` on the source page and
an enhanced, prepared source. It remains an experimental opt-in until the production performance
gate is accepted. The declaration does not enable that path by itself. Without the query opt-in,
the ordinary transition remains active; no application link or history migration is required.

`getSpatialListItems` also preserves each element's `minimap` settings so a compact destination
uses the same fit, pivot and docked orientation as its mounted detail. Custom synchronous shell
summaries receive `SpatialSummaryContext`. Initialize `createCatalogEndpointAction()` inside
the custom summary component and apply `context.address('title')` / `context.address('eyebrow')`
to its actual text nodes. The factory depends on the enclosing Stage context and cannot be
initialized by a parent above BrandStageShell. See the complete [live summary example](wiki/Summary-Panels.md).

## Renderer infrastructure

BrandStageShell.renderSettings accepts maxPixelRatio (default 1) and maxPixels (default 2,073,600). The tighter budget wins. maxPixels: null disables the area limit; invalid/nonpositive numeric values fall back to defaults. DOM text retains native resolution. Budget settings are applied at renderer creation and page binding; they are not an animation control. See [performance](performance.md).

BrandStageShell.dracoDecoderPath is the directory of host-served Draco decoder files, with trailing slash. Default: /assets/draco/gltf/. Models and decoders are not application static assets installed automatically by the package. Meshopt uses the Three.js decoder dependency.

Stage, Panel, StageViewport and StageExperience are lower-level building blocks for custom integrations. Stage's low-level standalone glb/hdr/model/background/camera options configure a manually composed scene; they do not need to be repeated when using BrandStageShell and page components. Manual Stage.catalog / CatalogPage is retained as a legacy adapter contract. New SvelteKit consumers should use page registration through the high-level components. Internal SpatialElementScene is a renderer projection, not a third authoring document.
