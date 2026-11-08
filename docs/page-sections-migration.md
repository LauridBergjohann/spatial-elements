# Page Sections adoption

Spatial Elements now uses the published `@page-sections/core@0.3.0` and `@page-sections/svelte@0.3.0` packages. npm installs them transitively. Brand example repositories are outside this migration.

## Responsibilities

Page Sections owns page/content composition, section markup and backgrounds, content grids, card markup, responsive menu structure, breadcrumbs, layout tokens and registries. Spatial Elements owns the stage, assets, GPU fitting, spatial carousel poses and input, persistent summary islands, docking, virtual document scrolling, history and transitions. Specialized spatial ButtonGroup and detail-tab controls retain their stage-specific behavior. The dependencies run only from Spatial Elements to Page Sections; core remains framework-independent.

Existing Spatial Elements component names remain available. ContentPage, Section, ContentGrid and ContentBlock delegate their presentation to Page Sections. There is no second card or menu markup implementation. Spatial-only layout tokens remain in `packages/core/src/spatial-element/layoutTokens.json`; common values come from Page Sections. The generated spatial stylesheet retains detail/carousel geometry and compatibility aliases.

## Cards

Cards use Page Sections 0.3.0. The media frame has its own configurable aspect ratio; the text area adds independent height. All cards in a collection have equal heights across rows.

- S: 2 columns, 12px title, two title lines, no eyebrow.
- M: 2 columns, 14px title, two title lines.
- L: 4 columns (3 in grid S), 18px title, three title lines.
- M/L reserve an additional eyebrow row for every item when any item has a nonblank eyebrow.
- Text padding is 12px; contained media has an 8px inset.

Use `mediaAspect="1/1"` (spatial default), `"3/2"` or `"4/3"`, `mediaFit="contain"` (default) or `"cover"`, and `cardTone="standard"` or `"muted"` on ListSection. SpatialListPage forwards these options. Keep `itemKey` stable for repeated items and reordering.

At a 320px collection width, an M card is 142px wide. With square media and an eyebrow reserve it is 226px high: 142px media plus 84px text. It is no longer a 142px square.

`resolveCardLayout(width, size, { mediaAspect, mediaFit, reserveEyebrow })` returns the same media/text geometry used by the shared component. Its width argument includes section gutters. Use collection-wide eyebrow reservation before mounting any subset; invalidate virtual row caches after width, format, size or label changes. The built-in list renders keyed items and does not maintain a separate estimated row-height cache.

The spatial card adapter attaches endpoint registrations to Card's actual root, surface, media, title and eyebrow. The persistent presentation host retains the same live root during transitions. Resizes are measured by existing spatial observers, without reattaching behavior. SSR produces native links and posters before enhancement.

## Navigation

Prefer `BrandStageShell`'s `brand` snippet, `items` array and optional `tools` snippet. Menu items require stable `id` values. `left` and `right` satellites are available in Settings below XL. The shared navigation owns mobile menus below L, widths (1536px in 2XL), surfaces and shadows. Spatial's wrapper applies the visual-scroll compensation once and registers native menu surfaces with the stage. Open shared navigation dropdowns use the browser top layer so projected detail panels cannot cover them. Their original DOM ownership and event handlers remain intact; they close on navigation, document scrolling and resize. Existing `menu` snippets remain supported as custom content and own their internal responsive behavior.

## Sections, themes and compatibility

Section definitions extend Page Sections metadata, including heading levels, spacing, layout, intro and eyebrow. Existing spatial section styling remains an adapter for width, text color and optional legacy glass material. Themes map semantic colors and radii to `--ps-*` variables. Detail pages keep their spatial tab lifecycle, with the shared registry tracking DOM order.

Private DOM selectors changed: use `[data-ps-card-part]` for card parts and `.ps-section-content` for section padding. Do not restore square-card CSS or override shared breakpoints in applications.

## Validation

Use `/demo/layout-cards` for S/M/L sizes, long/blank labels, live aspect changes, filtering and keyed reordering. Check 320px, 600px, 720px, 840px, 1200px and wide layouts, including smaller nested containers. Verify fallback/SSR, keyboard navigation, reduced motion, light/dark themes, list-to-detail-to-list and carousel transitions, fixed 3XL regions and focus/scroll restoration.
