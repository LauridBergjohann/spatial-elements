# Release preparation

No npm publication or release tag is created by this migration. Package-level private flags remain
true and versions remain 0.0.0. The public root and every demo application always remain private.

## Before the first release

1. Confirm ownership/access to the spatial-elements npm scope and select the first version.
2. Review docs/migration.md verification and any remaining dependency audit findings; run npm audit.
3. Run npm ci, npm run assets:demo, npm run verify, npm run build:demo and npm run test:e2e.
   Verify real tarballs also in the private app with npm run packages:packed, its check/build and
   brand acceptance tests. Restore packages:link afterwards.
4. Review npm pack contents, licenses and the public Git tree. Only original demo assets belong
   here. Runtime tarballs must not contain test data, recordings or brand assets.
5. Set the same release version in both packages and update the exact core dependency in sveltekit
   and workspace demos. Remove only the two library package private flags and configure
   publishConfig.access = public. Update the temporary-release assertion in verify-packages.mjs.
6. Add a changelog and release notes, commit/version-tag the reviewed result, then publish core
   before sveltekit. Choose interactive npm 2FA or explicitly configured trusted publishing;
   do not store an npm token in this repository. Review the then-current npm setup instructions.
7. Verify installation from npm in a clean consumer and publish the release notes.

## Deployment

The demo uses adapter-auto for development/build checks. Select a deployment adapter for the target
host before deployment. The private example app must not be automatically deployed to a public host.
MPL-2.0 license files are included in each package. Optional visible attribution is appreciated but
is not a new license condition. Dependencies retain their licenses; retain required notices when
redistributing their files (including any Draco decoder copied by an application).

## Current compatibility boundaries

Svelte 5 / SvelteKit 2 and Three.js 0.185; Node 22.12+ tooling. Hardware acceleration/WebGPU is an
optional enhancement with semantic HTML/poster fallback. Other framework adapters are future work.
The unchanged optional 3Dconnexion dependency emits a Vite crypto externalization warning; validate
SpaceMouse hardware separately if that feature is required. Large renderer chunk warnings are
expected; Three.js/runtime loading is deferred by the Stage component.
