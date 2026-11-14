<img src="../apps/website/static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" />

﻿# Changesets

Run npm run changeset for user-facing package changes and commit the generated release note.
Use patch for fixes, minor for compatible additions, major for breaking changes.
The two public packages version together. Run npm run release:version on the feature branch and commit its output in the same PR. Merging to main publishes missing versions automatically; no second release PR is created.
See [the release guide](../docs/release.md) for beta mode and one-time GitHub/npm setup.
