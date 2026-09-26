# Releases and GitHub Flow

## Daily development

Use short-lived branches and pull requests into main. Add a release note for changes to shipped
packages with:

~~~sh
npm run changeset
~~~

Select the affected package(s), patch/minor/major, and a short user-facing explanation. Commit the
generated .changeset/*.md file with the implementation. Documentation/tooling-only changes do not
need a changeset unless the documentation ships in the package, e.g. its README.

After merging, release.yml runs automatically. Changesets opens or updates a **release pull request**
with coordinated versions and per-package changelogs. Review and merge that PR into main: the
workflow then verifies, builds and publishes the missing npm versions automatically. No local
npm publish or additional workflow dispatch is needed. Several feature PRs can share one release PR.

core and sveltekit form a fixed version group. The version script keeps the adapter's core dependency
and demo dependencies exact, refreshes the lockfile, and selects beta/latest from the version.
The private root and demo applications are never published. This remains GitHub Flow, with no develop
or permanent release branch. Package-level CHANGELOG.md files are generated release history; the root
changelog records the initial release.

## Beta and stable versions

The repository is in Changesets prerelease mode (beta), continuing the published 0.1.0-beta.1.
The next included release note produces 0.1.0-beta.2. Further betas increment the prerelease counter.
Changesets accumulates patch/minor/major intent for the eventual stable release. Humans classify the
API impact; version numbers, dependency updates and changelogs are automated.

To prepare stable publication, run npm exec changeset pre exit on a reviewed branch and merge that
change. Review the resulting release PR carefully. Stable versions use latest, beta versions use beta.
Do not hand-edit pre.json or package versions during normal releases.

Both initial packages currently have beta AND latest pointing to 0.1.0-beta.1 (registry observation
2026-09-26). This automation does not remove existing tags; subsequent beta uploads only update beta.

## One-time GitHub and npm configuration

1. GitHub Settings > Actions > General: allow GitHub Actions to create and approve pull requests.
   The version job requests contents:write and pull-requests:write.
2. Configure a trusted publisher for **each** npm package:
   user LauridBergjohann, repository spatial-elements, workflow release.yml, environment npm.
   Enable direct npm publish in the publisher's allowed actions.
3. Configure GitHub environment npm for main deployments. To publish immediately after the merge,
   do not require an additional environment approval or wait timer; the reviewed release PR is the gate.
4. Set repository Actions variable NPM_TRUSTED_PUBLISHING_ENABLED=true.
   Missing setup is reported as a failed release plan when an unpublished version exists.

Only the publishing job receives id-token:write, on a GitHub-hosted runner with Node 24 / npm 11.
No npm token is needed. This checkout cannot configure npm account settings; verify these settings
in the respective UIs. See [npm Trusted Publishing](https://docs.npmjs.com/trusted-publishers/).

By default, Changesets uses GITHUB_TOKEN for the release PR. GitHub does not run ordinary push/PR
workflows in response to that bot token. If required PR checks remain pending, close and reopen the
release PR yourself to trigger them. For a fully automatic PR-check experience, optionally supply
RELEASE_PR_TOKEN from a suitably scoped fine-grained token (contents and pull requests write), or
adapt the workflow to generate a GitHub App token. Never weaken required checks to bypass this.
The final publication always runs its own full verification regardless of PR checks.

## Publication and recovery

The workflow runs on pushes to main and also supports workflow_dispatch for retries.
The plan checks the public npm registry: existing versions are skipped; network/auth/server errors
fail rather than being mistaken for absent versions. If all versions exist, there is no upload.
Pending Changesets go through the release PR first.

Before uploading, the exact triggering commit passes metadata validation, unit tests, independent
tarball consumer checks, demo build and fallback browser tests. The verified tarballs are archived
as a workflow artifact. Upload order is core, then sveltekit. No workspace-wide publish is used.
If only core succeeds, rerun the workflow: the existing core version is skipped and the adapter
is retried. Published versions cannot be overwritten.

Useful read-only/local checks:

~~~sh
npm run check:release
npm run test:release
npm run release:plan
npm run verify
npm run build:demo
npm run test:e2e
~~~

release:plan queries npm but never uploads. release:publish is restricted to Actions on main.
The npm environment, publisher identity and repository variable are still required.
Git tags and GitHub Release pages are optional follow-up metadata; this workflow does not create them.

## Three.js and compatibility

Three.js is a required peer dependency of both runtime packages. This expresses one compatible
application-level Three.js version, important when sharing objects/materials with other libraries.
A normal dependency could resolve to a second incompatible installation. Modern npm automatically
installs a missing peer; explicit installation is only needed when the app imports Three.js itself,
or for package managers/configurations that do not install peers automatically.

Svelte 5 / SvelteKit 2, Three.js ^0.185.1, Node 22.12+ tooling.
Semantic HTML and poster fallbacks remain available without GPU rendering.
Packages include MPL-2.0; attribution is appreciated, not a license condition.
Private brand assets remain outside the public repository and tarballs.
The existing optional 3Dconnexion and renderer chunk build warnings remain unchanged.

## References

- [Changesets v2 / Action v1](https://github.com/changesets/action/tree/maintenance/v1)
- [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow)
- [npm peer dependencies](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#peerdependencies)

## Automation validation (2026-09-26)

- Five release tests cover beta/latest routing, no-op runs, partial retries and registry failures.
- Isolated Changesets simulations passed for 0.1.0-beta.1 -> 0.1.0-beta.2 and beta exit -> 0.1.0.
- 222 runtime unit tests, all workspace type checks, demo build and six Chrome browser tests passed.
- The independent tarball consumer installs Three.js automatically without a direct three dependency;
  its type check and production/SSR build passed.
- Workflow YAML and separation of version-job and publishing-job permissions were checked.
- Live npm lookup confirms both initial versions exist; release:plan correctly performs no upload.
- Actual GitHub PR creation and OIDC publication require the one-time account settings above and
  have not been exercised by this local validation. No package was published during this change.
