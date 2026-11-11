# Spatial Elements website

Public documentation and showcase, authored directly in Svelte/HTML. Run npm run dev:website from the repository root. Page Sections supplies ordinary documentation layout; related spatial routes share BrandStageShell.

Edit src/lib/catalog.ts for chapter metadata and src/lib/navigation.ts for the tree. Keep parent pages, breadcrumbs, search and reading order synchronized. Examples use a single state for preview and source; static examples are highlighted during prerendering. See ../../docs/hosting.md and ../../docs/testing.md.

Wera and Rolex detail pages identify the content as demonstrations and link to the manufacturers. The watch also credits the Three.js example. Asset provenance is recorded in static/assets/ATTRIBUTION.md and src/lib/showcase/assets.json.
