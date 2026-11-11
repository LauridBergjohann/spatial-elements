# Testing

- npm run check:ci checks exact Playwright dependency/container alignment.
- npm run check:release checks the reviewed package versions, lockfile and consumed changesets.
- npm run check runs the shared layout check, package builds and Svelte/TypeScript checks for all apps.
- npm test covers the core, SSR, geometry and transition contracts.
- npm run check:docs compiles Svelte documentation snippets and checks built internal links when output exists.
- npm run build:apps builds demo, tests and website.
- npm run test:apps checks public navigation, themes, live code, no-shop notices, mobile/no-JavaScript content and the minimal consumer demo.
- Set SPATIAL_GPU=1 when running npm run test:apps to additionally require real WebGPU rendering and nested Wera collection/detail history navigation, with Wera and watch screenshots. This opt-in fails if enhancement is unavailable.
- npm run test:e2e runs the full rendering fixtures against apps/tests on port 4174.
- npm run verify:packages installs tarballs in an independent minimal SvelteKit consumer; npm run verify:published does the same with exact npm versions after release.

CI uses the pinned Playwright Noble container for browser dependencies and Node 24. It runs deterministic native/unsupported-GPU regressions and public website tests. Actual GPU rendering, scene transfers and performance require the dedicated fixture suites on a suitable WebGPU device; a fallback pass is not a GPU pass. Retain traces and screenshots for failures. Test servers never reuse unrelated running servers.
