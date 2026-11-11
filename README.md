<img src="apps/website/static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" height="64" />

# Spatial Elements

Spatial Elements brings interactive 3D models into content-driven SvelteKit websites. This repository contains the framework-independent rendering core, SvelteKit components, documentation website, minimal demo and regression application.

- **Content and models together:** compose spatial card grids, carousels and detail pages with ordinary HTML and Page Sections.
- **Persistent rendering:** share the stage, loaded assets and navigation state across related pages.
- **Responsive by design:** coordinate content layout, model fitting, docking and wide-screen reading panes.
- **Progressive enhancement:** real links, meaningful HTML and supplied poster images remain available without WebGPU.
- **Your assets and identity:** bring GLB models, HDR environments and themes; adapt materials, controls and interface texts.

**[Documentation, interactive examples and showcase](https://spatial-elements.bergjohann.com/)** — prepared publication address; see [hosting](docs/hosting.md).

## Installation

In a SvelteKit application:

```sh
npm install @spatial-elements/sveltekit@beta three@^0.186.1
```

For a custom renderer integration, install `@spatial-elements/core@beta` instead. Both packages are prereleases. Three.js is a shared peer dependency.

## Documentation and examples

Start with [Getting started](https://spatial-elements.bergjohann.com/getting-started/), explore the [interactive documentation](https://spatial-elements.bergjohann.com/docs/) and visit the [showcase](https://spatial-elements.bergjohann.com/showcase/). The website uses Page Sections and Spatial Elements itself; explanations are authored directly in Svelte/HTML.

[apps/demo](apps/demo) is the minimal working example. [apps/website](apps/website) is the public website. [apps/tests](apps/tests) contains technical fixtures and performance scenarios.

## Development

Use Node 24 and npm 11. Run `npm ci`, then `npm run dev:website`, `npm run dev:demo` or `npm run dev:tests`. See [application commands](apps/README.md), [development](docs/development.md), [testing](docs/testing.md) and [releases](docs/release.md).

## License

[Mozilla Public License 2.0](LICENSE). Showcase assets retain their own rights and attribution; they are not included in npm packages. A visible “Built with Spatial Elements” link is appreciated, but not required by an additional attribution condition.
