---
"@spatial-elements/core": minor
"@spatial-elements/sveltekit": minor
---

Adopt Page Sections 0.3.0 for common layout, section backgrounds and registries, page composition, cards and responsive navigation. Spatial adapters retain GPU endpoints, persistent card roots, carousel interaction, docking and virtual scrolling.

Cards use configurable media frames with independent equal-height text areas. SpatialCardGridSection (formerly ListSection) and SpatialListPage accept cardSize, cardVariant, cardTone, mediaAspect, mediaFit, textAlign and editorial itemSpan. SpatialCarouselSection (formerly CarouselSection) keeps rear models above opaque section backgrounds and clips rendering and interaction to the configured surface. The old component names remain deprecated aliases. BrandStageShell accepts brand, items and tools; small layouts expose satellites through Settings. See docs/page-sections-migration.md for changed geometry and private selectors.
