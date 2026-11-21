# Development

Use Node 24 and npm 11. The applications use SvelteKit 3 (configuration in `vite.config.ts`, native `#lib` imports) and Svelte 5. Install with npm ci. The packages build in dependency order through npm run build. Public runtime dependencies use Page Sections 0.5.0 and Three.js 0.187; no sibling checkout is required.

TypeScript stays on 6.0.3 because the current SvelteKit, svelte-package and svelte-check peer ranges do not support TypeScript 7. Node type declarations follow the Node 24 runtime. Lucide imports use the maintained `@lucide/svelte` package.

`SpatialCardGridSection` and `SpatialListPage` now use one card format: descriptions are displayed when provided, and `cardShadow` enables the resting shadow. Remove `cardVariant`. Omit `itemSpan` for responsive S/M/L allocation; explicit spans still use `ContentBlock`. A card root is an article with a stretched native title link. Spatial endpoints register the article, media, title label and eyebrow separately; keyboard focus belongs to the inner link.

SvelteKit 3 may mark a full back/forward navigation as shallow when its destination entry contains history metadata. The scroll bridge still captures and restores those page transitions. Catalog fade captures use the linear working color space so Three.js 0.187 can retain the warmed GPU pipeline between normal rendering and an outgoing transition. Hidden minimap effects compile sequentially because the renderer shares its asynchronous compilation state.

See [applications](../apps/README.md) for development and preview commands. Run npm run check, npm test, npm run build:apps and npm run test:apps. npm run verify includes formatting, release metadata, package boundaries, types, unit tests, documentation snippets and an isolated package consumer.

Author public explanations directly in the website's Svelte pages. Update the catalog and navigation alongside new routes. Use Page Sections for prose, headings and code. Keep GPU setup inside spatial examples and shared showcase layouts. Do not embed brand content or assets into the public packages.

Run npm run format:apps before committing. Theme tests compare configured tokens rather than freezing the website palette. See [testing](testing.md), [hosting](hosting.md) and [releases](release.md).
