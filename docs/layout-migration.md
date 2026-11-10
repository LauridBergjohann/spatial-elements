# Migrate to the content layout

For the current package integration, see [Page Sections migration](page-sections-migration.md).

This guide covers the source layout API introduced by the layout implementation plan. It is a
visible layout change: existing section headings must be explicit, sections default to transparent,
and list cards use grid spans instead of the former auto-fill widths. See [API](api.md) for the full
tables and [authoring](authoring.md) for working composition examples.

## Source compatibility and changed behavior

This layout update does not remove existing package-root exports or high-level component props.
Its layout changes affect rendered defaults; private DOM structure and positioning selectors
must be reviewed. New grid, shell-summary and endpoint APIs are additive. The expanded media
union also requires updating application-owned exhaustive switches over `SpatialElementMediaItem`.

| Existing path | Migration status |
| --- | --- |
| `section.title` as the visible headline | No longer implicit; add `headline` while retaining `title` |
| Default tinted section surfaces | Replaced by transparent backgrounds; choose an explicit background role |
| Fixed-minimum auto-fill list cards | Replaced by grid spans through `cardSize` and configurable media frames |
| Fixed summary heights and route-owned header positioning | Replace host geometry overrides with natural summary content and shell snippets |
| `section.style` and `SpatialTheme.sectionTheme` | Retained compatibility path for explicitly authored legacy material |
| `panelShape.radius` | Retained as the fallback for both new radius roles |
| `kind: 'drawing'` without a source | Still accepted by the type, but deprecated and displayed as unavailable; provide an image |
| `media: []` or a collection without `minimap` | Detail presentation inserts one initial 3D entry; duplicate minimap entries are ignored |
| Exhaustive handling of `SpatialElementMediaItem.kind` | Handle the new `video` and `youtube` variants in custom renderers or serializers |
| `BrandStageShell.deviceOrientation` / low-level `Stage.deviceOrientation` | Retained for detail geometry and minimaps; SpatialCardGridSection and SpatialCarouselSection already enable sensors automatically and have no such prop |

The earlier removals of `SpatialStageConfig` and Product-prefixed names are separate changes:
see [configuration migration](configuration-migration.md) and [terminology migration](spatial-element-migration.md).

## Preserve section identity and visible content

Keep every existing `id` and `title`; anchors, accessibility and generated detail tabs depend on
them. Add `headline` to preserve a visible heading. It may differ from the shorter navigation title.

~~~svelte
<!-- Before -->
<Section section={{ id: 'features', title: 'Features' }}>
  <p>Existing content.</p>
</Section>

<!-- After: keep the heading and intentionally choose a solid surface -->
<Section section={{
  id: 'features', title: 'Features', headline: 'Features',
  background: { color: 'standard' }
}}>
  <p>Existing content.</p>
</Section>
~~~

Omit `headline` only when a section should have no generated visible heading. It still has an
accessible label and a navigation title. SpatialCardGridSection and SpatialCarouselSection use the same definition:
add `headline` there too, normally keeping their transparent background.

## Choose section surfaces deliberately

The new default is transparent. `background: { color: 'standard' }` selects the theme's solid
standard color; it does not reproduce the old translucent material pixel for pixel. The migrated
demo and starter use this explicit solid surface for ordinary content sections.

Keep explicitly authored legacy `style.tint`, `tintOpacity` and `backdropBlur` intact until you
choose their replacement. They remain supported when a new background role is absent. Retain
`style.textColor` independently. A custom color/blur has no automatic exact equivalent among
standard/muted roles; use an intentional host-specific migration rather than silently discarding it.

Use `size: 'full'` for viewport-wide decoration on ContentPages. Only effectively full backgrounds
may use gradients. Detail sections always constrain backgrounds to standard width, so gradients
there fall back to their end color with a development diagnostic. Transparent/full-width sections
break rounded groups; adjacent standard/muted solid sections share the group's outer corners.

## Replace structural overrides with grid blocks

The content grid is capped at 1536px and responds to its actual container width. Sections own its
outer padding. Remove redundant application margins or repeated padding that would double these
gutters. Use ContentGrid with ContentBlock spans to split content explicitly. Arbitrary children
remain valid and are never redistributed automatically. Review any legacy `style.width` override;
prefer a container restriction or block span appropriate to the intended layout.

SpatialCardGridSection defaults to `cardSize="m"` and `textAlign="start"`. Choose `s` or `l` deliberately;
there is no longer a 250px auto-fill minimum or 360px card maximum. Cards use Page Sections 0.3.0. The media frame has its own configurable aspect ratio; the text area adds independent height. All cards in a collection have equal heights across rows.

- S: 2 columns, 12px title, two title lines, no eyebrow.
- M: 2 columns, 14px title, two title lines.
- L: 4 columns (3 in grid S), 18px title, three title lines.
- M/L reserve an additional eyebrow row for every item when any item has a nonblank eyebrow.
- Text padding is 12px; contained media has an 8px inset.

Use `mediaAspect="1/1"` (spatial default), `"3/2"` or `"4/3"`, `mediaFit="contain"` (default) or `"cover"`, and `cardTone="standard"` or `"muted"` on SpatialCardGridSection. SpatialListPage forwards these options. Keep `itemKey` stable for repeated items and reordering.

For responsive detail, persistent menus, a single movable section-navigation instance and the
document-scrolled ultra-wide pane, continue with the [illustrated migration reference](wiki/Migration-and-Reference.md).

## Split theme radius roles

Use `radii: { control: 12, panel: 16 }` to distinguish cards/small controls from larger panels.
Old manually constructed themes remain accepted. An explicitly set `panelShape.radius` supplies
both roles until new `radii` fields override it; `panelShape.contentInset` is independent. Section
colors use `sectionBackgrounds: { standard: '#ffffff', muted: '#f5f7f9' }`, independently of
panel material tint. Check light/dark theme changes with both DOM fallback and enhanced rendering.

Before merging a migrated page, verify retained headings/navigation, no horizontal overflow,
container-boundary layouts, keyboard focus, no-JavaScript posters and geometry/text alignment.

## Replace source-less media

The framework does not invent a technical drawing. Keep its stable media ID and supply the
actual image with meaningful alternative text:

```ts
// Before: accepted for compatibility, but has no content to display.
media: [{ id: 'dimensions', kind: 'drawing', label: 'Dimensions' }]

// After: the initial 3D entry is inserted automatically before this image.
media: [{ id: 'dimensions', kind: 'image', label: 'Dimensions',
  src: '/assets/dimensions.webp', alt: 'Enclosure dimensions in millimetres' }]
```

Selecting image or video media releases the hidden main model's input and sensor participation.
Returning to 3D reuses its resources; navigating away and back starts with 3D again.

## Adopt persistent content and navigation deliberately

Place the main menu and optional satellites in `BrandStageShell.menu`, `.left` and `.right`.
Supply content-only snippets; the shell owns their responsive box, surface and scroll behavior.
Remove a duplicate route-owned menu and its old fixed-position offsets when making this change.

For stateful carousel-to-detail summaries, define `BrandStageShell.summary` in the persistent
layout and register the actual title/eyebrow endpoints inside the custom component. The same
summary renderer can retain its live instance across the source-first handoff. A card uses a
different renderer, so arbitrary card-local state is not transferred to the detail summary.
See [Summary Panels](wiki/Summary-Panels.md) for the complete example and synchronous-content limits.

Source-first navigation is currently experimental and requires `?stagedNavigation=1` on the
source page. Ordinary transitions remain the default. `targetPresentation: 'dock'` declares a
known compact destination; it does not activate the experiment or alter native scroll limits.
Keep ordinary links and existing SvelteKit navigation policies. See [Transitions](wiki/Transitions.md).
