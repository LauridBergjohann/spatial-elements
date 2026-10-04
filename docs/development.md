# Developing Spatial Elements

This guide is for working on the packages themselves. To use them in an application, start with [Getting started](getting-started.md).

## Repository setup and public demo

Use Node.js 22.12 or newer and npm. From the repository root:

~~~sh
npm ci
npm run assets:demo
npm run build
npm run demo
~~~

Open `/demo/categories/mixed` on the local server. The public demo includes list, carousel, mixed-content and detail examples using original procedural assets. The [getting-started example](getting-started.md) is available at `/starter/categories/list`.

Run `npm run dev` in another terminal to watch and rebuild both packages while the demo is running. The demo consumes the built workspace packages by name.

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

The touch regressions use Chrome's mobile viewport and trusted touch input through the browser protocol:

~~~sh
npm run test:e2e -- carousel-touch.e2e.ts detail-touch.e2e.ts
~~~

They cover simultaneous carousel rotation and page scrolling, changes of direction, release damping on both axes, model rotation/pinch handoff, immediate background scrolling, and mouse-only hover on hybrid devices. The carousel coordinates both axes inside model areas; scrolling outside them and two-finger page zoom remain native. The interaction contract is documented in [Authoring](authoring.md#touch-and-pointer-interaction). Physical-device checks remain useful for Safari and device-specific input latency.

## Development across repositories

Clone `spatial-elements` and the private `spatial-elements-brand-examples` as sibling directories for local development and local builds. Run `npm ci` in the public repository once to install its tools. The public repository never imports or needs the private one.

The private application provides three explicit package-source modes:

| Mode | Public repository | Private repository |
| --- | --- | --- |
| Development with HMR | Keep `npm run dev` running; wait for the initial build and watchers | `npm run dev:local` |
| Test the current local packages | Current checkout, including uncommitted changes | `npm run build:local`, then `npm run preview` |
| Test the published packages | No sibling checkout required | `npm run build:remote`, then `npm run preview` |

`dev:local` restores file-linked dependencies from the committed lockfile and starts Vite. Vite watches the built package output and deduplicates Svelte and Three.js. No source copy, source alias or global `npm link` is required. Package exports or build-configuration changes may require a server restart.

The build modes install real package copies: fresh sibling tarballs for `build:local`, or the current npm `latest` versions for `build:remote`. Stop development and preview servers before switching modes. Run `npm run packages:status` in the private repository to inspect the installed sources. Plain `npm run dev` and `npm run build` use the existing installation without selecting a mode.

See the private [README's development and build modes](../../spatial-elements-brand-examples/README.md#development-and-build-modes) for complete steps. The committed manifests and lockfiles retain local `file:` dependencies in every mode; running `npm ci` in the private repository restores the linked installation.

## Test the delivered artifacts

Public: npm run verify:packages builds an independent consumer from existing package builds. Run
npm run verify for the full build-first pipeline. Its metadata and logs live in .artifacts/packages.
The installed consumer remains in the OS temporary directory for investigation.

Private: use `npm run build:local` before checking the current package artifacts, or `npm run build:remote` to validate the published versions. Then run the private type, unit and browser checks without running `npm ci` between them. To select packages without building the application, use `npm run packages:packed` or `npm run packages:remote`. The packed command also builds the sibling packages and keeps its tarballs in ignored `.local-packages`. Both install with `--no-save` and `--package-lock=false`, verify the package sources and leave source manifests and lockfiles unchanged. `npm run packages:link` restores file links for development.

Keep @types/three aligned across linked repositories (currently 0.186.0); divergent copies can
produce incompatible recursive type identities even when runtime Three.js is deduplicated.

## Architecture and maintenance

- [Architecture overview](architecture/README.md): context, containers and components.
- [Runtime scenarios](architecture/runtime.md): preparation, navigation, rendering and cleanup.
- [Asset contract](architecture/assets.md): representations, canonical frames and resource ownership.
- [Decisions](architecture/decisions.md): accepted foundations and repository boundaries.
- [Package boundaries](package-boundaries.md): public APIs and dependency rules.
- [Performance analysis](performance.md): measured bottlenecks, render budgets and profiling.
- [Migration audit](migration-audit.md) and [migration record](migration.md): repository extraction and migration history.
- [Release workflow](release.md): versioning, verification and publication.

Update architecture alongside changes to ownership, navigation order, cache lifetime or public contracts. Keep brand-specific evidence in the private examples repository.
