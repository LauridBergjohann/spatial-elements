# Development

Use Node 24 and npm 11. Install with npm ci. The packages build in dependency order through npm run build. Public runtime dependencies use published Page Sections packages; no sibling checkout is required.

See [applications](../apps/README.md) for development and preview commands. Run npm run check, npm test, npm run build:apps and npm run test:apps. npm run verify includes formatting, release metadata, package boundaries, types, unit tests, documentation snippets and an isolated package consumer.

Author public explanations directly in the website's Svelte pages. Update the catalog and navigation alongside new routes. Use Page Sections for prose, headings and code. Keep GPU setup inside spatial examples and shared showcase layouts. Do not embed brand content or assets into the public packages.

Run npm run format:apps before committing. Theme tests compare configured tokens rather than freezing the website palette. See [testing](testing.md), [hosting](hosting.md) and [releases](release.md).
