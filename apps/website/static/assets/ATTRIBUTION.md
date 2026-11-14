# Showcase assets

Wera, Logitech and item product geometry, photographs and video links were supplied
by the author from their local product library. The Rolex watch geometry was
imported from the author's spatial-elements-brand-examples project. The product
names identify the demonstrated objects; the website is an independent technical
showcase, not a shop or an official manufacturer website. Manufacturer links and
the no-purchase notice appear on every product detail page.

The eight Wurm product models are reviewed low/high pairs from the same brand
examples project. The item and Wurm logos and company photographs were supplied
by the author in `assets/brands`. Their website copies are in `static/assets/brands`;
photographs and the Wurm logo are converted to WebP. The import recipe and original
model manifest references are recorded by `tooling/asset-pipeline/import-industrial.mjs`.

The Three.js watch example was a major motivation for Spatial Elements: https://github.com/mrdoob/three.js/blob/master/examples/webgl_watch.html

Models and photographs are website demonstration assets and are not included in
the npm packages. Source hashes, optimization decisions and resource costs are
recorded in `tooling/asset-pipeline/showcase-geometry-report.json`; photo provenance is recorded
in `tooling/asset-pipeline/showcase-media.json` and its generated report. Poster
images are renders of the supplied geometry in the configured detail pose.
Existing third-party asset rights remain with their respective owners. The
repository's source-code license does not relicense these third-party assets.

The shared HDR lighting environment is retained from the author's existing
showcase. YouTube videos are linked to their original pages; their players are
loaded only when the visitor selects a video. Videos are not downloaded or
redistributed by this repository.
