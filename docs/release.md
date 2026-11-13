# One pull request per release

## Prepared website release

Both public packages are already prepared as `1.0.0-beta.10`. For this release, commit and merge the prepared branch without running `changeset` or `release:version` again. The release workflow publishes this version under **beta**; it does not move **latest**. Consumers can explicitly install it with:

```sh
npm install @spatial-elements/core@beta @spatial-elements/sveltekit@beta
```

Before the first merge with the new publishing workflow:

1. Configure an npm trusted publisher on **both** `@spatial-elements/core` and `@spatial-elements/sveltekit`: GitHub owner `LauridBergjohann`, repository `spatial-elements`, workflow filename `release.yml`, environment `npm`, direct npm publication.
2. Create/check the GitHub Actions environment `npm`. Set the repository or environment **variable** `NPM_TRUSTED_PUBLISHING_ENABLED` to `true` after configuring both publishers. No npm token secret is needed. If the environment has reviewers, approve the release job when requested.
3. Push the feature branch and create one pull request targeting `main`. Wait for the Verify workflow and inspect the Vercel preview before merging.
4. After merging, check the Release workflow, including its final registry consumer verification, and the separate Vercel production deployment. A failed partial publication can be retried by rerunning Release on `main`.

See [npm trusted publishers](https://docs.npmjs.com/trusted-publishers/) for account-side setup and [website hosting](hosting.md) for Vercel configuration.

## Subsequent releases

Prepare versions on the feature branch before merging:

```sh
npm run changeset
npm run release:version
npm run verify
npm run build:apps
npm run test:apps
```

Commit the implementation, generated package versions, changelogs, exact internal/app dependencies, prerelease state and lockfile in the same PR. Both public packages form a fixed version group. Package README changes need a release to update npm; website-only changes do not.

Merging to main runs release.yml: verification, builds, browser checks, publication of missing exact versions with provenance, then independent registry consumer verification. It creates no second PR and does not bump versions. Already published versions are skipped, so retries after partial publication are safe. Registry visibility is retried before the consumer installation.

The repository remains in Changesets beta mode. New prereleases use the beta npm tag unless explicitly promoted in release-channels.json. Historical latest promotions remain untouched. To leave prerelease mode, run npm exec changeset pre exit and npm run release:version in a reviewed PR; do not manually edit pre.json.

Configure a trusted publisher for each npm package: owner LauridBergjohann, repository spatial-elements, workflow release.yml, environment npm, direct npm publish. Set NPM_TRUSTED_PUBLISHING_ENABLED=true once configured. OIDC requires no committed token. Environment review rules may still require approval. RELEASE_PR_TOKEN and permission for Actions to create PRs are no longer needed.

Vercel deploys the website independently from main. The workflow does not create a GitHub release or tag. Check both jobs before declaring the whole release complete.
