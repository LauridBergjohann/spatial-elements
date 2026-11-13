# Content grid, sections and cards

Status: implementation specification, 31 October 2026. Runtime support is not implied by this document. The names below are the proposed additive authoring API for steps 02–05 of the [layout implementation plan](../../layout-system-implementation-plan.md). Changes to these names must update the examples and migration table together.

## Sources and decision precedence

The source set is the updated `Content Grid.png`, `Cards.png`, `Sections.png` and `Layout Erläuterungen.pdf` supplied on 31 October 2026. Source hashes and provenance belong in `sources.json`; original references containing private brand material are archived separately and are not a dependency of the public documentation or demo.

Later explicit author decisions override image/PDF values. This specification resolves these known differences:

| Topic | Canonical rule | Reason |
| --- | --- | --- |
| Small card title | 9px | Author correction overrides the remaining 8px labels. |
| Large card in grid S | Three columns | Author correction; the six-column grid illustration shows two large cards per row. |
| Grid M headline line height | 32px | PDF and drawing dimensions agree; the 28px label in the grid illustration is stale. |
| Card title line heights | S 18px, M 20px, L 24px | Updated card illustration. |
| Gradients | Only on an effective full-width section background | Author correction. Requested `full` alone does not establish eligibility. |
| Detached section corners | Also apply on ordinary ContentPages at viewport layout 3XL | Author correction; the detail ContentPane is still excluded. |

The constrained-card text reserve and invalid-gradient fallback below are explicit engineering decisions for implementation. They are not additional dimensions claimed to have been specified in Figma. Their acceptance fixtures must remain visible during review.

## Grid geometry

The page layout selects the grid container's width. Grid classification uses that container's CSS inline size **before section padding**, independently of viewport width and device pixel ratio. The container is capped at 1536 CSS pixels. Margin, gutter and section padding use the same token; the margin is implemented once as section padding, not as a second surrounding inset.

| Container width `c` | Grid | Columns `n` | Padding/gutter `g` | Headline size / line height | Body size / line height | Headline-to-content gap |
| --- | --- | --- | --- | --- | --- | --- |
| `c < 600` | `xs` | 4 | 12px | 18px / 28px | 14px / 20px | 8px |
| `600 <= c < 840` | `s` | 6 | 16px | 18px / 28px | 14px / 20px | 8px |
| `840 <= c < 1200` | `m` | 8 | 16px | 20px / 32px | 14px / 20px | 12px |
| `1200 <= c <= 1536` | `l` | 12 | 24px | 24px / 40px | 16px / 24px | 16px |

Headline weight is semibold (600); body weight is regular (400). The host retains the font family. CSS font loading and font substitution must not change the grid's fixed rectangles, although ordinary text flow may change height.

For the root grid, a column has width `a = (c - 2g - (n - 1)g) / n`. A block spanning `s` columns has width `s*a + (s - 1)g`. Preserve fractional CSS pixels through calculation and round only where a renderer requires it. All vertical section padding also equals `g`. Consecutive sections have their own bottom/top padding; there is no additional default outer margin between their backgrounds.

The named query container must wrap the padded section rather than measure its already padded content box. For example, `c = 840` selects grid M even though its content width is 808px. Nested grids, if supported later, require an explicit query scope and must not accidentally capture the section's queries.

### Authoring API draft

```ts
type ContentGridSize = 'xs' | 's' | 'm' | 'l';
type ContentSpan = number | Partial<Record<ContentGridSize, number>>;

// ContentGrid: children; uses the current section grid and adds no second padding.
// ContentBlock: span?: ContentSpan; children.
```

`ContentGrid` lays out explicit `ContentBlock` children. Omitted `span` fills the row. A responsive span inherits the last defined smaller-grid value; before its first defined value, the block fills the row. A single number applies to every grid. Spans must be finite positive integers. Invalid values use a full-row fallback with a development diagnostic; spans exceeding the active column count clamp to that count and produce a development diagnostic for that authored combination.

Blocks flow in DOM order. No dense placement, automatic text columns, or visual order independent of focus/reading order is introduced. Arbitrary HTML remains allowed inside each block. Existing arbitrary Section children continue as ordinary content without automatic conversion into grid items.

```svelte
<Section section={{ id: 'features', title: 'Features', headline: 'Built for everyday use' }}>
  <ContentGrid>
    <ContentBlock span={{ xs: 4, s: 6, m: 4, l: 4 }}>
      <p>A first independently authored content block.</p>
    </ContentBlock>
    <ContentBlock span={{ xs: 4, s: 6, m: 4, l: 8 }}>
      <p>A second block with its own content and reading order.</p>
    </ContentBlock>
  </ContentGrid>
</Section>
```

## Section semantics and backgrounds

The section `id` remains the stable anchor. `title` remains its navigation/accessibility label. New optional `headline` controls the visible heading and need not equal `title`. An omitted headline creates neither a heading-height placeholder nor the headline-to-content gap. The section still has its normal padding and an accessible name; it must not retain `aria-labelledby` pointing to a removed node. A suitable visible heading level is derived from the page structure, not from the visual font size.

```ts
type SectionBackgroundColor =
  | 'transparent' | 'standard' | 'muted'
  | 'transparentToStandard' | 'transparentToMuted'
  | 'standardToTransparent' | 'standardToMuted'
  | 'mutedToTransparent' | 'mutedToStandard';

interface SectionBackground {
  color: SectionBackgroundColor;
  size?: 'standard' | 'full';
}

// Additive fields on SpatialElementSectionDefinition:
// headline?: string;
// background?: SectionBackground;
```

For the new layout path, the engineering default for omitted background is `{ color: 'transparent', size: 'standard' }`. This is a new-layout default; it does not silently reinterpret a legacy tinted section during migration. An explicitly configured background has the same meaning for Section, SpatialCardGridSection and SpatialCarouselSection. A default transparent background lets the list/carousel keep their spatial presentation; authors can intentionally choose opaque surfaces.

`standard` background width is the full grid container including its padding. `full` extends only the background to the page's available viewport width; the content remains on the same capped grid. This does not increase document scroll width. In SpatialCarouselSection, the rendering and gesture area follow the surface width; ordinary section content stays on the capped grid. Transparent means actual transparency, not a painted copy of the page color. In the detail ContentPane, it therefore reveals the Pane surface first.

Gradients run from their first color at the top to their second color at the bottom across the entire section background. Standard and muted colors come from the theme. Transparent endpoints use the corresponding opaque color's hue at zero alpha to avoid an unintended dark fringe. No extra blurred layer is implied by a gradient.

### Normalization order

1. Resolve the requested background and `size` defaults.
2. Resolve effective size from page context. Ordinary ContentPages honor `full`; detail sections constrain it to `standard`, including inside the 3XL Pane.
3. Retain a gradient only when effective size is `full`. Otherwise use the gradient's **end color** and emit one development diagnostic for the offending author configuration/context, not one per animation frame. Do not change the configuration object in place.
4. Determine corners from the resulting effective background and section neighbors.

Examples: `transparentToStandard/full` on ContentPage remains a full-width gradient. The same request on detail becomes a standard-width solid `standard` section. `standardToTransparent/standard` becomes transparent. This deterministic end-color behavior is the engineering fallback, so the diagnostic must state both the invalid request and the effective result. No warning is required merely because detail constrains a solid `full` background.

### Joined corners

Use the large panel radius for contiguous groups of opaque, standard-width sections that visibly stand apart from the page background. Under the agreed viewport-layout rule, apply this grouping at XL, 2XL and ordinary ContentPage 3XL. The 3XL detail ContentPane already owns its outer corners and disables section grouping corners.

- Round the top pair when this is the first eligible section or its preceding neighbor is transparent or effectively full-width.
- Round the bottom pair when this is the last eligible section or its following neighbor is transparent or effectively full-width.
- A Standard/Muted color change inside an eligible group does not create a new rounded boundary.
- A transparent section, an effective Full section, or any section inside the 3XL detail Pane has no detached grouping radius of its own.

Evaluate adjacency from registered section order after background normalization, not from the presence of unrelated navigation/helper DOM siblings. Detail `full` requests normalized to standard are eligible under the same rule as authored standard-width sections. Border-radius is painted consistently by DOM and GPU surfaces; descendants must not be clipped indiscriminately, because card hover geometry may extend beyond its own fit region.

## Cards and SpatialCardGridSection

```ts
// Additive SpatialCardGridSection props:
// cardSize?: 's' | 'm' | 'l'; // default 'm'
// textAlign?: 'start' | 'center'; // default 'start'
```

The whole SpatialCardGridSection uses one card size and alignment. Each item independently supplies an optional eyebrow. `start` follows the document writing direction rather than hard-coding physical left. Cards remain real links, keep stable occurrence/focus identity, and expose their full title as an accessible name even when the visible text is clamped.

| Card | Column span | Title size / weight | Eyebrow size / weight | Shared line height | Max title rows without / with eyebrow | Total row budget |
| --- | --- | --- | --- | --- | --- | --- |
| `s` | 1 | 9px / 500 | Not shown | 18px | 1 / not applicable | 1 |
| `m` | 2 | 12px / 500 | 10px / 400 | 20px | 2 / 1 | 2 |
| `l` | 4, except 3 in grid S | 18px / 500 | 14px / 400 | 24px | 3 / 2 | 3 |

The eyebrow is a single clamped row. An empty/whitespace-only eyebrow consumes no row. Titles use their allowed number of rows and ellipsis; they do not reserve an invisible eyebrow row. Center the **actual rendered text block** vertically between the media fit region and the card's bottom edge. The media slot and card height remain uniform for a given list regardless of which items have eyebrows. Text alignment affects eyebrow and title together.

### Deterministic media and text allocation

Let `W` be the square card allocation width. The border is painted inside the box and does not enlarge it. Default media allocation has width `W` and height `3W/4`; its aspect ratio is 4:3. Model and poster fit completely and without distortion into this region before hover. Their actual visible shapes may leave empty space. Rotation and hover enlargement are presentation effects and do not change the list grid or allocated card height.

Engineering defaults for constrained cards:

- The eyebrow shares the card class's line height, so the total line budget remains deterministic.
- Reserve a minimum of 2px above and 2px below the text block. This extra 4px is an engineering allowance, not a quoted Figma measurement.
- Set `textHeight = max(W/4, rowBudget*lineHeight + 4)` and `mediaHeight = max(0, W - textHeight)`.
- Fit a 4:3 rectangle into the remaining `W × mediaHeight` area: `fitWidth = min(W, 4*mediaHeight/3)`, `fitHeight = 3*fitWidth/4`; center it in that area. The image/model never stretches to a different ratio.
- Use a 4px minimum horizontal text inset for the first implementation. This is an engineering default to validate visually, not a new outer grid gutter. Do not add another fixed vertical gap between eyebrow and title on top of their shared line heights.

At a 320px grid XS, a medium card is 142px square. Its nominal 35.5px text quarter cannot hold two 20px lines. The resolved text zone becomes 44px; the 4:3 fit rectangle becomes approximately 130.667 × 98px. A small card is 65px square, reserves 22px text height, and fits its media into approximately 57.333 × 43px. This preserves square cards and readable specified line heights without hiding overflow or scaling the font down. The 320px case is a mandatory visual acceptance fixture.

Browser/text zoom may increase the required line metrics. CSS and renderer must derive the fit from the same resolved allocation rather than assuming the unzoomed arithmetic still holds. If a host's arbitrary font override exceeds even the whole card height, prioritize accessible non-overlapping content through a documented narrow-layout fallback; do not promise support for an impossible combination of fixed square geometry and unlimited font growth. The implementation must exercise ordinary browser zoom and text enlargement, not only nominal device widths.

## Theme and page API

Keep the existing `SpatialTheme.background` as the flat page fallback. Add optional author-facing groups with resolved factory defaults:

```ts
// Additive fields on SpatialTheme / createSpatialTheme input:
interface SpatialLayoutThemeFields {
  radii?: { control: number; panel: number };
  sectionBackgrounds?: { standard: string; muted: string };
}

// Additive ContentPage prop:
interface ContentPageBackgroundProps {
  background?: string;
}
```

`radii.control` applies to small controls, form fields, media thumbnails, submenus and cards. `radii.panel` applies to summary panels, the 3XL ContentPane and detached section groups. Values are non-negative finite CSS pixels; reject or normalize invalid values once when resolving the theme. A resolved theme has both roles even when older application code supplies neither. Keep `panelShape.contentInset` as a separate concern; neither radius implies padding.

The two section colors are independent of `panelTheme.tint` and `dockedPanelTheme.tint`. Glass/frosted panel appearance continues to use those existing material controls. A section color is not a request to render a WebGPU panel. `ContentPage.background` overrides the flat page color only for that page and must update both native DOM and enhanced rendering; it does not replace HDR lighting or mutate the persistent brand theme.

During migration, explicit new roles win. If an old theme explicitly sets `panelShape.radius`, use it for both roles until that theme opts into the split. Otherwise the initial factory defaults are 12px for controls and 16px for panels. Resolve missing section colors to stable factory defaults and document their exact palette with the theme implementation. Do not silently derive `muted` from an arbitrary brand ink color or HDR image.

## Migration contract

| Existing API/behavior | Migration |
| --- | --- |
| `section.id` and `section.title` | Keep their anchor/navigation identity. Add `headline` explicitly to preserve a previously visible heading. A temporary legacy layout path can retain old rendering until the call site is migrated. |
| `SpatialElementSectionStyle.tint`, `tintOpacity`, `backdropBlur` | Preserve on the legacy path. New background roles replace these for the new layout; custom colors/blur without an exact role equivalent require an explicit host wrapper/style migration rather than silently discarding them. |
| `style.textColor` | Keep as an orthogonal text override where supported; it must not select a different grid or background role. |
| `style.width` | Move structural width to the new page/grid/block contract. A custom width that cannot be represented by a span requires an explicit container restriction and queries based on that actual width. Do not retain the old unconditional <=1100px width override. |
| Single `panelShape.radius` | Compatibility fallback for both new radius roles until the host adopts `radii`. Existing material fields and content inset remain separate. |
| Old Section outer margins and individual rounded boxes | Replace with section padding, contiguous backgrounds and neighbor-based corners. Migrate examples deliberately; do not layer the new gutters over old margins. |
| List auto-fill minimum 250px, max card width 360px, geometry height 228px | Replace together with grid spans, square allocations and shared model/poster fit. Native fallback and enhanced geometry must change in the same integration commit. |
| Title21px/two rows on all cards | Replace with the selected class's typography and row budget; retain full accessible link text. |
| Arbitrary Section children | Continue as content. Only `ContentGrid`/`ContentBlock` opt into explicit block placement; no automatic text redistribution. |

A temporary internal migration switch may keep old routes functional while examples move. It is not a permanent second public layout API. The implementation must diagnose contradictory legacy/new appearance settings instead of applying accidental CSS precedence. API changes, replacement examples and any required breaking-change notice ship together.

## Acceptance fixtures and commit boundaries

The public demo owns neutral, redistributable fixtures. Private brand examples provide integration coverage but are not prerequisites for public documentation.

| Fixture | Required evidence |
| --- | --- |
| Grid boundaries | Same viewport with differently sized containers; 599.5/600/600.5, 839.5/840/840.5, 1199.5/1200/1200.5 and 1536px cap. Query class, gaps, spans and root padding agree between CSS and resolver within 1 CSS pixel. |
| Grid author order | Unequal spans, inherited spans, oversized/invalid spans and empty blocks. DOM reading/focus order remains authored; no dense backfilling. |
| Section headings | Different navigation title/headline, omitted headline, long headline. No phantom spacing or dangling accessible label; anchors and generated navigation remain stable. |
| Section backgrounds | All nine requested colors × standard/full across ContentPage, detail XS–2XL and detail3XL. Assert normalized color/size, diagnostic deduplication, no horizontal scroll introduced, no accidental opaque fill for transparency. |
| Joined corners | Single section; Standard→Muted; transparent breaks; Full breaks; first/last section; helper DOM between registered sections; ContentPage3XL; detail3XL exclusion. |
| Card matrix | All sizes on all four grids, start/center, mixed eyebrows, long titles, and image/3D equivalents. GridS large cards form two cards per full row. |
| Constrained cards | 320px and 356px containers, plus normal mobile widths. Check fit aspect ratio, reserved rows, ellipsis, complete accessible titles and no overlap at normal and enlarged text settings. |
| Interaction/fallback | Real links, keyboard outline, touch scroll, mouse hover beyond fit area, sensor pause/recalibration, SSR/noJS and unavailable WebGPU. Hover must not steal a neighboring card's link. |
| Theme migration | Legacy-only, new-only, mixed conflicting fields, runtime light/dark switch and page background override. DOM and GPU share dimensions/radii without recreating element identity. |

Implement and review separately: (1) pure grid/token resolver, (2) ContentPage and explicit grid blocks, (3) Section/theme semantics, (4) SpatialCardGridSection/card geometry and renderer fit, then (5) integration/migration cleanup. Runtime tests are unnecessary for this specification-only commit. Each implementation commit needs its focused fixtures plus type/package checks appropriate to the affected layer.

Wiki chapters `Layout-and-Content-Grid`, `Sections-and-Backgrounds` and `Lists-and-Cards` should reuse these canonical tables, annotate engineering allowances, and include the 320px exception. Screenshots should come from the executable public fixtures. Do not make readers infer values from downscaled design images or depend on the original private source archive.
