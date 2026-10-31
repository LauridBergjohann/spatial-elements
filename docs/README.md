# Documentation

## Using the packages

- [Getting started](getting-started.md): install the packages and build collection and detail pages.
- [Authoring](authoring.md): compose content, element lists, carousels and detail pages.
- [API reference](api.md): configure element data, themes, components and rendering.
- [Illustrated layout guide](wiki/Home.md): container grids, sections, cards, detail layouts, persistent navigation, media and migration. The portable Markdown/image export is prepared locally with `node docs/wiki/export.mjs` and is not published automatically.
- [Interface texts and help](interface-texts.md): host-owned translations, English defaults and 3D guidance.
- [Asset contract](architecture/assets.md): prepare model representations and shared coordinate frames.
- [Layout migration](layout-migration.md): update section headings, surfaces, cards, live summaries and media defaults. [Configuration migration](configuration-migration.md) and [SpatialElement API migration](spatial-element-migration.md) cover preceding pre-release API changes.

## Developing the packages

The [development guide](development.md) covers repository setup, the public demo, checks and cross-repository workflows. It also links to architecture, package boundaries, performance analysis, migration history and release documentation.

- [Layout system implementation plan](layout-system-implementation-plan.md): responsive layout rules, incremental commits and validation, live panels, document-scrolled ultra-wide pages, and illustrated GitHub Wiki documentation.
- [Staged catalog transitions plan](staged-catalog-transitions-plan.md): the subsequent navigation work, based on the completed layout system, with commit boundaries and validation criteria for immediate forward navigation.
