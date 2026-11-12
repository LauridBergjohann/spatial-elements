# Asset tooling

## Procedural examples

`npm run assets:demo` creates the original procedural low/high GLBs, SVG posters
and a small Radiance HDR, then synchronizes the application directories. It needs
no third-party models or downloads.

## Product showcase

The website ships generated assets in
`apps/website/static/assets/showcase/<product-id>/`. Each directory contains a
low and high GLB, a transparent 1024 × 1024 WebP poster, and any supplied product
photographs in WebP with smaller variants. Product names, descriptions and
manufacturer/video links live in `apps/website/src/lib/showcase/products.json`;
camera poses and material overrides live in the adjacent `presentation.json`.

The original Wera, Logitech and item files are read from `../assets/products`
relative to the repository. They are never modified or copied wholesale into the
website. The reviewed watch source pair is retained in `sources/`, outside the
deployed website. Third-party asset rights are described in the website's
`static/assets/ATTRIBUTION.md`.

After `npm ci`, regenerate photos and geometry with:

```sh
npm run assets:showcase
```

For a source library in another location, run the generators individually:

```sh
node tooling/asset-pipeline/generate-showcase-media.mjs --source /path/to/products
node tooling/asset-pipeline/optimize-showcase.mjs --source=/path/to/products
```

`showcase-media.json` and `showcase-products.json` are the reviewed source and
recipe inventories. Photos are normalized to WebP, capped at 1600 pixels for
detail views and 640 pixels for thumbnails, without upscaling. Existing small
images can share their full-size file. Videos stay on YouTube; the website loads
a player only after selection and exposes ordinary links without JavaScript.

Low geometry is used for category views and minimaps; high geometry is loaded
for product details. Simplification preserves attributes and shared framing.
The website grids use large cards to give each product room while staying within
the runtime's existing 16-instance limit at the reviewed desktop viewport.
Models outside the viewport are released as the visitor scrolls; the showcase
does not raise the global loading or residency limits.
Wera materials are combined into atlases to reduce draw calls; existing normal
and roughness maps retain surface detail. This does **not** bake newly removed
polygon details into normal maps. Texture limits reduce decoded GPU memory as
well as transfer size. The watch keeps its reviewed geometry and textures;
compatible meshes are joined while preserving its named glass material override.

The colored and dark grip surfaces in Kraftform XXL, Kraftform Kompakt 20 and
Zyklop Speed overlap in the authored models. Simplifying these layers separately
produced visible intersections, even with locked material borders. Their grip
materials therefore retain the original geometry; the remaining components are
simplified and compatible materials still share an atlas. These three reviewed
low-LOD budget exceptions are explicit in `showcase-products.json` (180,000,
90,000 and 42,000 triangles respectively). Actual counts remain below those
limits. Forcing a smaller triangle target would trade recognizable, clean
surfaces for artifacts. The M750 low LOD also uses a tighter error limit and
stronger normal preservation to retain its smooth shell and side grooves.

New Logitech and item products use a normalized shared frame so their authored
metre dimensions do not make small components disappear in the demo. The source,
low and high models retain matching coordinates; the same frame transform is
applied to all three. Reviewed microscopic Wera framing markers and the Ergo
keyboard's shadow plane are excluded explicitly in the inventory.

Imported cameras and lights are removed from every product; the website owns
the presentation camera and lighting. In particular, four item exports contain
a point light that would otherwise change the entire shared catalog's lighting
as each card enters the viewport, triggering shader recompilation during scroll.
Removing these components preserves their transform nodes and any child meshes.
Source comparisons apply the same cleanup; the original files remain untouched.

The full generated `showcase-geometry-report.json` records source/output hashes,
triangle counts, draw calls, texture dimensions, decisions and size estimates.
The website imports only a small geometry descriptor index. GPU-memory figures
in the report are estimates (RGBA8 plus mipmaps), not device measurements.
Photo provenance and byte totals are in `showcase-media-report.json`.
`showcase-validation.json` compares the final assets against the previous
website and records the reviewed quality tradeoffs.

## Posters and visual review

Build the core first, then render the actual optimized geometry with the same
framing, detail camera pose, material overrides, HDR and lighting as the website:

```sh
npm run build
npm run assets:showcase:render
```

The renderer uses local Chrome with WebGPU, or Playwright Chromium in CI. To
render a subset and compare source/high/low from the detail, back, side and
minimap views:

```sh
node tooling/asset-pipeline/render-showcase.mjs --only=joker,tool-check-plus --compare
```

Set `SHOWCASE_SOURCE_ROOT` for comparisons against a source library elsewhere.
Comparison sheets and pixel/silhouette measurements go to `.artifacts/showcase/`.
`showcase-poster-report.json` records each committed poster's hashes, camera pose
and shared frame; tests catch stale posters after model or presentation changes.
Inspect these visually: silhouette overlap alone cannot verify texture quality,
small lettering, reflections or internal detail. Posters are committed website
assets, so neither production builds nor no-JavaScript visitors need the renderer
or private source library. A live detail view may use a different aspect ratio;
the product pose is shared, while its camera fit follows the available viewport.

## Verification

```sh
npm test -- tooling/asset-pipeline
npm run assets:showcase:check
```

Artifact tests validate the committed assets without the original product
library. The second command needs that library and regenerates geometry to
compare output bytes; it is a slower reproducibility check. Individual geometry
can be checked with `--product=joker --check`. Exact tool versions are pinned in
the root package manifest and lockfile.

For runtime measurements, build the website and run
`node scripts/profile-showcase.mjs my-run`. Optional environment variables
`PROFILE_WIDTH`, `PROFILE_HEIGHT`, `PROFILE_DPR` and `PROFILE_PORT` select the
viewport and local preview port; `PROFILE_PRODUCT` fixes the detail-transition
product (default: `tool-check-plus`). Reports go to `.artifacts/performance/`.
Set `PROFILE_GRID_ONLY=3` to measure the first grid scroll and two repetitions
without navigation. `PROFILE_TRACE=1` records the Chrome CPU/GPU timeline and
periodic stage diagnostics; `PROFILE_GPU_API=1` records created render pipelines
and their shader source. These diagnostics add overhead, so use a separate run
without them for timing comparisons. `showcase-performance.json` records the
reviewed comparison, its hardware, workload differences and limitations.
Use one GPU browser at a time and compare the same device, viewport and content;
the expanded showcase has more products than the previous website.
