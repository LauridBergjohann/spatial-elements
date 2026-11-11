# One pull request per release

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
