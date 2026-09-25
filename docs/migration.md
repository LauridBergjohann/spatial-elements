# Repository and package migration

The six-phase catalog implementation was accepted in the original development repository.
This is a separate extraction/publication preparation project, starting from a clean Git history.

| Step | Scope | Status |
| --- | --- | --- |
| 1 | Monorepo, package builds, root exports, license and package verification | Implemented; validation recorded below |
| 2 | Extract real runtime and SvelteKit components; enforce framework boundary | Planned |
| 3 | Public SvelteKit demo with neutral shared assets | Planned |
| 4 | Private brand-example application and brand-specific regression tests | Planned |
| 5 | Cross-repository local development and watch workflow | Planned |
| 6 | Full consumer installation/SSR/build tests and release documentation | Planned |

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
