# Spatial Elements

A framework for spatial immersive content experiences.

Present products, individual items or entire collections through immersive, interactive interfaces powered by three.js and WebGPU.

## Status

This repository contains the monorepo/package infrastructure. The existing catalog runtime has
not been migrated yet. Both packages are private until extraction and release verification are
complete; no npm release is available from this scaffold.

## Development

Use Node.js 22.12 or newer and npm (lockfile version 3).

```sh
npm ci
npm run verify
npm run dev
```

The root build runs core before sveltekit. The dev command first builds both, then watches both
packages. There is no demo server yet. Package entry points are their built dist/index.js and
dist/index.d.ts files; consumers must use the package names, not source-directory aliases.

- packages/core: framework-independent ESM/TypeScript package.
- packages/sveltekit: Svelte packaging pipeline and framework integration boundary.
- apps: future framework demos (not part of npm package contents).
- fixtures/demo-assets: future shared, redistributable demo assets.
- tooling/asset-pipeline: future generic asset-production tools.

See [the migration plan](docs/migration.md) for the next steps and [package boundaries](docs/package-boundaries.md).

## License and attribution

[MPL-2.0](LICENSE).

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Suggested link: [Built with Spatial Elements](https://github.com/LauridBergjohann/spatial-elements). This request does not amend the license.
