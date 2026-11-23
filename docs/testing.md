# Testing

- npm run check:ci checks exact Playwright dependency/container alignment.
- npm run check:release checks the reviewed package versions, lockfile and consumed changesets.
- npm run check runs the shared layout check, package builds and Svelte/TypeScript checks for all apps.
- npm test covers the core, SSR, geometry and transition contracts.
- npm run check:docs verifies generated type tables, compiles Svelte documentation snippets and checks built internal links and anchors when output exists.
- npm run build:apps builds demo, tests and website.
- npm run test:apps checks public navigation, themes, live code, no-shop notices, mobile/no-JavaScript content and the minimal consumer demo.
- showcase-docs.app.ts follows the beginner reading order, exercises field/type navigation and search, changes the live CardGrid/Carousel controls and verifies light/dark Hero artwork. SPATIAL_GPU=1 also exercises those collections with WebGPU.
- Set SPATIAL_GPU=1 when running npm run test:apps to additionally require real WebGPU rendering and nested Wera collection/detail history navigation, with Wera and watch screenshots. This opt-in fails if enhancement is unavailable.
- The carousel drag and framing suites also require SPATIAL_GPU=1: they inspect rendered model readiness, layer ordering and transitions. Standard CI reports these tests as skipped; an opted-in GPU run must reach `enhanced` and never silently accepts `fallback`. Run just these suites with `SPATIAL_GPU=1 npm run test:apps -- showcase-carousel-drag.app.ts showcase-carousel-framing.app.ts` (PowerShell: `$env:SPATIAL_GPU='1'; npm run test:apps -- showcase-carousel-drag.app.ts showcase-carousel-framing.app.ts`).
- npm run test:e2e runs the full rendering fixtures against apps/tests on port 4174.
- npm run verify:packages installs tarballs in an independent minimal SvelteKit consumer; npm run verify:published does the same with exact npm versions after release.

CI uses the pinned Playwright Noble container for browser dependencies and Node 24. It runs deterministic native/unsupported-GPU regressions and public website tests. Actual GPU rendering, scene transfers and performance require the dedicated fixture suites on a suitable WebGPU device; a fallback pass is not a GPU pass. Retain traces and screenshots for failures. Test servers never reuse unrelated running servers.
