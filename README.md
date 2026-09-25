# Spatial Elements

A framework for spatial immersive content experiences.

Present products, individual items or entire collections through immersive, interactive interfaces powered by three.js and WebGPU.

## Packages

- **@spatial-elements/core**: framework-independent renderer, asset lifecycle, LOD, camera interaction, panels and catalog transitions.
- **@spatial-elements/sveltekit**: Svelte components and SvelteKit navigation/history integration.
- **apps/sveltekit-demo**: public list, carousel, mixed-content and detail examples using original procedural assets.

The implementation is extracted and usable locally. Packages remain private at version 0.0.0
until the release checklist is approved; nothing has been published to npm.
Future framework adapters can use core; no placeholder React/Vue packages are shipped.

## Development

Use Node.js 22.12 or newer and npm.

~~~sh
npm ci
npm run assets:demo
npm run build
npm run demo
~~~

The demo opens at /demo/categories/mixed. Run npm run dev in another terminal to watch package
changes. npm run verify checks boundaries, types, unit tests, builds and an independently installed
packed SvelteKit consumer. npm run build:demo followed by npm run test:e2e checks the demo in Chrome.

See [authoring](docs/authoring.md), [cross-repository development](docs/development.md),
[package boundaries](docs/package-boundaries.md), [migration](docs/migration.md) and [release](docs/release.md).

## License and attribution

[MPL-2.0](LICENSE).

A visible “Built with Spatial Elements” link is appreciated, but not required. This does not replace your obligations under the MPL-2.0 license.

Suggested link: [Built with Spatial Elements](https://github.com/LauridBergjohann/spatial-elements).
Dependencies retain their own licenses. The optional attribution request does not amend the license.
