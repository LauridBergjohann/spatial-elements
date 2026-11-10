# Spatial Elements Showcase

The editorial demo for rich 3D models, images and stories. The initial application
provides the persistent stage, responsive navigation and two-state light/dark
controls; collections and detail content are intentionally left for authors.

From the repository root:

```sh
npm ci
npm run dev:showcase
# http://localhost:5174

npm run build:showcase
npm run preview:showcase
# http://localhost:4175
```

Use `npm run dev` in another terminal to watch the library packages while editing
them. Application source has Vite HMR. Both build commands prepare the workspace
libraries first. The preview command serves the existing production build.

## Add your content

- Edit `src/lib/navigation.ts` for menu entries. The same entries feed desktop and
  mobile navigation; the theme control occupies the right satellite from XL and
  moves inside the menu below that breakpoint.
- Replace `src/routes/+page.svelte` with your landing page.
- Create catalog routes at `/showcase/categories/list` or
  `/showcase/categories/carousel`, and detail routes at `/showcase/elements/[id]`.
  This matches the theme ID `showcase` and the library's navigation contract.
- Use `ContentPage`, `SpatialCardGridSection`, `SpatialCarouselSection`, `SpatialElementPage` and
  `Section` inside the existing root layout. Do not create another stage per page.
- Keep element data in `src/lib/`, and models, HDRs, posters, images and videos in
  `static/assets/`. See [Getting started](../../docs/getting-started.md) for the
  data structure and [asset contract](../../docs/architecture/assets.md).
- A Draco-compressed model also needs decoder files at `/assets/draco/gltf/`, or
  an explicitly configured `dracoDecoderPath` on the shell.

## Appearance and provenance

`src/lib/themes.ts` adapts the neutral surfaces and green/teal palette from
[bergjohann.com](https://github.com/LauridBergjohann/bergjohann-com), local revision
`5463b79`, `src/app.css`. Spatial surfaces use the framework's own theme contract.
Inter is hosted locally, with its OFL license and source record in
`static/fonts/inter/`. No external font request is needed.

The switch has exactly two choices: Light and Dark. Before the first explicit
choice it follows the OS; a selection persists in session storage through reloads.
The early HTML bootstrap and SSR palette styles avoid an initial light flash.
Blocked storage does not prevent switching. Without JavaScript the system palette
still applies, the menu works, and the theme buttons remain disabled.

No language switch or private brand content is included. This app is private in
npm and is built in CI, but is not published with the runtime packages.

## Source formatting

Run `npm run format:apps` from the repository root to format Demo and Showcase source with Prettier and its Svelte plugin (100-character target width). `npm run check:format` checks the same files and runs as part of `npm run verify` in CI. Configure the editor to use the repository Prettier configuration for format-on-save.
