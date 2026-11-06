# Developing Spatial Elements

This guide is for working on the packages themselves. To use them in an application, start with [Getting started](getting-started.md).

## Repository setup and demo applications

Use Node.js 22.12 or newer and npm. From the repository root:

~~~sh
npm ci
npm run dev:basics
# http://localhost:5173
~~~

**Basics** explains the library with simple forms and a fixed light theme.
**Showcase** is the independent application for richer authored content, with
light/dark appearance adapted from bergjohann.com.

~~~sh
npm run dev:showcase
# http://localhost:5174

npm run build:apps
npm run preview:basics
# http://localhost:4174
# In another terminal:
npm run preview:showcase
# http://localhost:4175
~~~

Run one app startup at a time so its initial package build finishes before
starting the other. Application files use HMR; run `npm run dev` in another
terminal to watch library changes. `build:basics` and `build:showcase` build an app
individually, including the library packages. Preview serves its existing build.
See [applications](../apps/README.md) and [Showcase authoring](../apps/showcase/README.md).
The minimal getting-started route remains at `/starter/categories/list` in Basics.

## Checks

Run the full verification pipeline after preparing the demo assets:

~~~sh
npm run verify
~~~

This checks release metadata, release tooling, package boundaries, types, unit tests, package builds and an independently installed packed SvelteKit consumer.

To check the public demo in a browser:

~~~sh
npm run build:demo
npm run test:e2e
~~~

Build the packages first if you have not already done so. Local browser tests use an installed Chrome; CI uses Playwright's Chromium.

Set `SPATIAL_E2E_DEV=1` to run against Vite's development server instead of the preview build. This also checks Svelte's development-mode component cleanup in `catalog.e2e.ts` and the repeated detail-navigation regression in `interaction-help.e2e.ts`.

The touch regressions use Chrome's mobile viewport and trusted touch input through the browser protocol:

~~~sh
npm run test:e2e -- carousel-touch.e2e.ts detail-touch.e2e.ts interaction-help.e2e.ts
~~~

They cover simultaneous carousel rotation and page scrolling, changes of direction, release damping on both axes, model rotation/pinch handoff, immediate background scrolling, and mouse-only hover on hybrid devices. The carousel coordinates both axes inside model areas; scrolling outside them and two-finger page zoom remain native. The interaction contract is documented in [Authoring](authoring.md#touch-and-pointer-interaction). Physical-device checks remain useful for Safari and device-specific input latency.

## Application and package boundaries

Both applications consume the two workspace packages by name. The private
`spatial-elements-brand-examples` repository is no longer part of the active demo
workflow. Its existing checkout and assets are not moved or deleted.

`npm run verify:packages` builds an independent consumer from existing package
builds; `npm run verify` is the build-first pipeline. Evidence is in
`.artifacts/packages`, and the installed consumer remains in the OS temporary
directory for investigation. `npm run test:apps` checks the Basics and Showcase
shells against production builds. Existing GPU and navigation regression
suites continue to use the Basics application and its isolated proof routes.

## Architecture and maintenance

- [Architecture overview](architecture/README.md): context, containers and components.
- [Runtime scenarios](architecture/runtime.md): preparation, navigation, rendering and cleanup.
- [Asset contract](architecture/assets.md): representations, canonical frames and resource ownership.
- [Decisions](architecture/decisions.md): accepted foundations and repository boundaries.
- [Package boundaries](package-boundaries.md): public APIs and dependency rules.
- [Performance analysis](performance.md): measured bottlenecks, render budgets and profiling.
- [Migration audit](migration-audit.md) and [migration record](migration.md): repository extraction and migration history.
- [Release workflow](release.md): versioning, verification and publication.

Update architecture alongside changes to ownership, navigation order, cache lifetime or public contracts. Keep authored showcase content and application-specific evidence outside the runtime packages.
