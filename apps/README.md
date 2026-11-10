# Demo applications

Both applications live in this repository and consume the workspace packages by
name. Neither application needs `spatial-elements-brand-examples`.

| Application | Purpose | Directory |
| --- | --- | --- |
| **Spatial Elements Basics** | Simple procedural forms, lists, carousel and detail pages; permanently light. | `sveltekit-demo/` |
| **Spatial Elements Showcase** | Richer authored experiences; prepared navigation and light/dark theme. | `showcase/` |

Basics keeps its existing directory, package name and `/demo` URLs so examples,
profiling tools and regression fixtures retain stable references. Its start page
opens the list. `/starter` and `/proof` remain available for development; advanced
proofs are not in the public menu. `/proof/theming` isolates the original theme
regressions from the permanently light Basics application.

The **Layouts** menu links to `/demo/layouts` and all six interactive layout
examples: cards, content grid, section backgrounds, docking, media and reading
pane. The overview explains what to try on each page.

The other Basics route groups serve different development purposes:

| Routes | Purpose |
| --- | --- |
| `/starter/categories/list` and `/starter/elements/cube` | Working minimal application from the Getting started guide, intended as a starting point for consumers. |
| `/staged/categories/list`, `/staged/categories/carousel` and `/staged/elements/*` | Advanced transition fixtures with known dock destinations and a persistent interactive summary. Used to verify prepared navigation, return transitions and retained input state. |
| `/proof/*` | Focused development and regression fixtures for rendering, layout, persistence, theme behavior and performance. Several expose test instrumentation or use private internals; they are not general authoring examples. |

These are route groups inside the demo application, not separate packages or
deployment environments. Their URLs remain stable because tests and development
tools use them.

Run these commands from the repository root after `npm ci`:

| Task | Basics | Showcase |
| --- | --- | --- |
| Development | `npm run dev:basics` — port 5173 | `npm run dev:showcase` — port 5174 |
| Production build | `npm run build:basics` | `npm run build:showcase` |
| Serve production build | `npm run preview:basics` — port 4174 | `npm run preview:showcase` — port 4175 |

`npm run build:apps` builds both applications and their library dependencies.
`npm run test:apps` checks both production previews; set `SPATIAL_E2E_DEV=1` to run
the same checks against development servers. `npm run dev` watches the library
packages in another terminal. Launch the app commands sequentially when starting
both, because each first builds the same libraries. The servers then run together
on their distinct ports.

The existing `npm run demo` and `npm run build:demo` commands continue to work.
`build:demo` remains a build-only shortcut for tooling that already built packages.
Basics synchronizes the original assets from `fixtures/demo-assets`; run
`npm run assets:demo` only when regenerating those procedural assets.

See [Showcase authoring](showcase/README.md) for adding your content. The previous
private examples repository is not deleted or imported into the public showcase.
