# Migrate to the content layout

This guide covers the source layout API introduced by the layout implementation plan. It is a
visible layout change: existing section headings must be explicit, sections default to transparent,
and list cards use grid spans instead of the former auto-fill widths. See [API](api.md) for the full
tables and [authoring](authoring.md) for working composition examples.

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
accessible label and a navigation title. ListSection and CarouselSection use the same definition:
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

ListSection defaults to `cardSize="m"` and `textAlign="start"`. Choose `s` or `l` deliberately;
there is no longer a 250px auto-fill minimum or 360px card maximum. Cards remain square at all
grid sizes. Small cards omit eyebrows; medium/large cards share a two-/three-line budget between
eyebrow and title. Narrow cards reduce their media fit area to preserve these fixed line heights.
Check the 320px case with long titles and mixed eyebrows. Keep full accessible link text, posters
and ordinary anchors when applying custom content styles.

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
