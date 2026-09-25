# Repository and package migration

The six-phase catalog implementation was accepted in the original development repository.
This is a separate extraction/publication preparation project, starting from a clean Git history.

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Monorepo, package builds, root exports, license and package verification | Implemented; validation recorded below |
| 2 | Extract real runtime and SvelteKit components; enforce framework boundary | Implemented; verified below |
| 3 | Public SvelteKit demo with neutral shared assets | Implemented; verified below |
| 4 | Private brand-example application and brand-specific regression tests | Complete; verified below |
| 5 | Cross-repository local development and watch workflow | Complete; verified below |
| 6 | Full consumer installation/SSR/build tests and release documentation | Complete; verified below |

The private repository is spatial-elements-brand-examples. No brand assets, generated manifests,
recordings, old Git history or lab working files are copied into this repository. The original
application remains unchanged and usable during step 1.

## Step 1 verification

Run npm ci and npm run verify from the root. Verification builds both packages, packs their
allowlisted contents, inspects exports/license and imports both tarballs from an isolated consumer.
The consumer also checks TypeScript declaration resolution. Artifacts remain under ignored
.artifacts/. This establishes packaging infrastructure, not functional catalog or component coverage.
Real Svelte rendering, navigation, SSR and production consumer tests follow the extraction.

### Recorded result (2026-09-25)

- Windows / Node.js 24.21.0: checks and both builds passed.
- Tarball allowlists, license copies, ESM imports and TypeScript declaration resolution passed.
- Both watch builds started successfully without compilation errors.
- svelte-check reports one expected warning because no Svelte components have been extracted yet.
- SvelteKit was updated to 2.70.3 after auditing the initial toolchain. npm audit still reports
  two low-severity entries (cookie and its dependent SvelteKit); review this dependency chain
  before the demo/release. No running application is shipped by this scaffold.
- The original application working tree was not modified.

The CI workflow repeats installation and verification on Node.js 22 / Ubuntu. Its remote result
is separate from the local verification above.

## Steps 2-3: extraction and neutral demo

Renderer/controllers and product contracts now live in core; Svelte authoring/context and Kit
navigation live in sveltekit. App aliases were replaced with real package/relative ESM imports.
HTML attribute types stay in the adapter. HDR/model URLs are supplied by applications; Draco
decoder paths are configurable. Generic regressions use neutral fixture names. No private assets
or generated brand indexes were copied into the public repository.

The public demo includes list, carousel, mixed content, details and anchor navigation, with three
original procedural low/high models, SVG posters and a generated HDR. Type checks have zero errors
and warnings. Both package builds and the demo production build pass. Six Chrome tests pass for
WebGPU navigation/history, section links, no-JS and unavailable-GPU fallback. An isolated consumer
installed from actual tarballs passes Node core import, Svelte type checks, SSR and production build.

## Steps 4-6: private application, development and release checks

Completed 2026-09-25. The private application consumes package exports and retains its brand routes,
original/optimized models, posters and asset reports. No runtime/component source is duplicated.
The public repository has an independent history and only original neutral demo assets.

Verification on this Windows machine (Node.js 24.21.0 / Chrome):

- 220 generic unit tests across 46 files passed in core.
- 41 private brand/asset tests across 6 files passed.
- All package, public-demo and private-app type checks passed with zero errors/warnings.
- Public and private production builds passed.
- Six public browser cases passed against workspace packages and again against an independently
  installed tarball consumer: WebGPU list/carousel/mixed navigation, history, section anchors,
  no-JavaScript and unavailable-GPU fallback.
- Thirteen private brand/history browser cases passed with linked packages. Six brand acceptance
  cases passed again with real tarball copies (all three brands).
- A temporary Svelte component edit reached the running private app through HMR; the core watch
  build reacted to a temporary TS change. Both edits were restored, and test-owned processes stopped.
- npm run assets:catalog:check passed for all 17 private products. Stale poster alt metadata was
  aligned with the existing generator; geometry/poster binary files were not changed.
- npm run verify passed: boundaries, types, unit tests, builds, package allowlists/licenses, Node
  import without DOM/GPU, isolated consumer installation, declarations, SSR and production build.

The private app is restored to file-linked development mode after tarball acceptance. Public CI
runs Node 22/Ubuntu verification, demo build and the two browser fallback cases; hardware WebGPU
and real-brand validation remain local/private. CI status is available on the repository Actions tab.

Release preparation is documented in release.md. Package private flags remain enabled and no npm
publication, release tag or public deployment was performed. npm audit --omit=dev reports two low
entries in the SvelteKit/cookie dependency chain. The deprecated lucide-svelte dependency and optional
3Dconnexion build warnings are retained compatibility considerations; review before first release.

The first clean CI run exposed build ordering: the demo typecheck needs both package declaration
outputs. The check command now builds both libraries before checking any workspace, so a fresh
clone does not depend on existing dist files.
