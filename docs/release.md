# Releases and GitHub Flow

## Current candidate

Both libraries are prepared as **0.1.0-beta.1**, with public access and the npm **beta** tag.
The npm scope and account 2FA are confirmed by the maintainer. Nothing has been published or tagged.
Root and demo manifests remain private; only the two libraries are publishable.

## Branching

Use GitHub Flow: branch from main, make focused commits, open a pull request, run verification,
review, squash/merge into main, and delete the short-lived branch. No develop or permanent release
branch is needed. Release preparation follows the same flow. Tag the exact published main commit
as v0.1.0-beta.1 and create a GitHub prerelease after both packages are verified on npm.

Recommended main ruleset: require a pull request and the "verify" status check, block force pushes
and deletion. A solo maintainer need not require an approval they cannot give themselves.
These settings must be configured on GitHub; this document does not claim they are enabled.
See [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow).

## Candidate verification

~~~sh
npm ci
npm run assets:demo
npm run verify
npm run build:demo
npm run test:e2e
npm audit
~~~

verify checks release metadata, boundaries, types, unit tests and actual tarball installation in an
independent consumer, including SSR and production build. Artifacts are in .artifacts/packages/.
Inspect npm pack contents and licenses. Private brand assets must never enter this repository or
the tarballs. Test the private brand application with packages:packed, then restore packages:link.

## First publication: interactive 2FA

After merging the reviewed PR, use a clean checkout of that main commit and repeat verification.
These commands actually publish and require a deliberate maintainer decision:

~~~sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish .artifacts/packages/spatial-elements-core-0.1.0-beta.1.tgz --access public --tag beta --ignore-scripts
npm publish .artifacts/packages/spatial-elements-sveltekit-0.1.0-beta.1.tgz --access public --tag beta --ignore-scripts
~~~

Publish the tested tarballs, not all workspaces. Complete npm's interactive 2FA prompts.
The beta tag is essential: a prerelease version alone does not prevent publication to latest.
Do not commit credentials. If the second upload fails, inspect npm first and publish only the missing
adapter tarball; a published version cannot be overwritten. Do not rerun the entire workflow blindly.

## Subsequent releases: Trusted Publishing

The manually dispatched release.yml workflow publishes from main only, runs verification and
fallback browser tests, then uploads core before the adapter. It publishes the exact verified tarballs.
It is disabled until the repository variable NPM_TRUSTED_PUBLISHING_ENABLED is set to true.

Configure both npm packages with a GitHub Actions trusted publisher:

- Organization/user: LauridBergjohann
- Repository: spatial-elements
- Workflow filename: release.yml
- Environment: npm
- Allowed actions: enable direct npm publish for this workflow.

Create the GitHub environment npm, restrict deployment branches to main, and configure a reviewer
if available for your account/repository setup. Then enable the repository variable above.
The workflow uses Node 24 / npm 11 and OIDC; no NPM_TOKEN secret is required.
It does not run on merge, tag creation or GitHub Release publication.

For the next beta, update both library versions, the adapter's exact core dependency, demo
dependencies, lockfile and CHANGELOG through a PR. Dispatch "Publish npm beta" on main with the
exact version. Stable releases require a separate deliberate update to check-release.mjs and
publishConfig/tag; the current process intentionally accepts only the 0.1.0-beta series.

See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/) and
[scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/).

## After publication

Check both exact versions and beta dist-tags on npm. Install the published adapter and Three.js in
a clean SvelteKit application outside this workspace; run type checks, SSR/build and browser checks.
Only after this succeeds, tag the published commit and create a GitHub prerelease with changelog notes.
Mark the changelog candidate as published with its actual date. Do not promote beta to latest
until the stable-release decision.

## Deployment and compatibility

Demo hosting is independent of npm publication. Select a deployment adapter before hosting the public
demo; never deploy the private brand app publicly. Packages include MPL-2.0 license files.
Visible attribution is appreciated, not an additional license condition. Retain third-party notices.

Svelte 5 / SvelteKit 2 and Three.js 0.185 within declared peer ranges; Node 22.12+ tooling.
WebGPU is optional, with semantic HTML/poster fallback. Other framework adapters are future work.
The optional 3Dconnexion dependency emits a Vite crypto externalization warning; validate SpaceMouse
hardware separately. Large renderer chunk warnings are expected; Stage defers runtime loading.

## Candidate validation (2026-09-26)

- Release metadata, source boundaries and all workspace type checks passed.
- 222 unit tests and all 6 public Chrome browser tests passed.
- Demo production build and independent tarball consumer type check / SSR build passed.
- Both tarballs passed npm publish --dry-run with public access and the beta tag.
- npm audit reports 3 low-severity entries along the cookie -> SvelteKit -> adapter-auto chain.
  No moderate/high/critical findings. The suggested automatic fixes downgrade SvelteKit to old
  releases, so no forced dependency change was applied.
- Registry installation, actual OIDC publication and GitHub environment/ruleset configuration
  remain post-merge maintainer steps. This preparation did not publish packages or create a tag.
