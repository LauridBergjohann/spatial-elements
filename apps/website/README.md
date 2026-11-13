<img src="static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" />

# Spatial Elements website

Public documentation and showcase, authored directly in Svelte/HTML. Run npm run dev:website from the repository root. Page Sections supplies ordinary documentation layout; related spatial routes share BrandStageShell.

Edit src/lib/catalog.ts for chapter metadata and src/lib/navigation.ts for the tree. Keep parent pages, breadcrumbs, search and reading order synchronized. Examples use a single state for preview and source; static examples are highlighted during prerendering. See ../../docs/hosting.md and ../../docs/testing.md.

Wera, Logitech, item and Rolex detail pages identify the content as demonstrations and link to the manufacturers. The watch also credits the Three.js example. All 18 products have low/high geometry and rendered WebP fallbacks; supplied photographs and YouTube links are available as product media. Asset provenance is recorded in `static/assets/ATTRIBUTION.md` and `tooling/asset-pipeline/showcase-geometry-report.json`. See the asset-pipeline README for reproducible generation and quality checks.

The showcase is organized into `/showcase/consumer/` (Logitech), `/showcase/workbench/` (Wera), `/showcase/industrial/` (item) and `/showcase/exclusive/` (Rolex). Product details live below their collection. The shared segment metadata drives navigation, search, links and breadcrumbs.
