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
