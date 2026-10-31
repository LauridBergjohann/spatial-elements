# Maintain and export the layout wiki

The public source is `docs/wiki/`. It contains portable Markdown chapters, neutral diagram sources, raster versions and screenshots from public demo routes. Private brand assets and original design images are intentionally excluded. Nothing in these commands publishes or pushes a wiki.

## Update content and figures

1. Change canonical geometry in `packages/core/src/spatial-element/layoutTokens.json`, regenerate layout CSS, and complete the affected runtime checks before updating documentation evidence.
2. Update the explanatory chapters. Run `node docs/wiki/export.mjs --write` to regenerate the complete token reference from the canonical JSON. Review hand-authored explanatory tables against that reference.
3. Edit diagram SVG sources under `docs/wiki/images/`, then run `node docs/wiki/render-diagrams.mjs`. This uses Chromium without GPU acceleration to produce matching PNGs. Inspect the raster output for clipping and readable labels.
4. After the coordinated production demo build, start its preview and run `node docs/wiki/capture-screenshots.mjs --base-url=http://127.0.0.1:4174`. It captures seven detail widths, two card overview widths and the large-card S-grid exception with real WebGPU and records the route, size and mode. Run this separately from GPU acceptance/performance suites. The two production-pane images come from `tests/detail-pane.e2e.ts`; copy them only after that test passes and visual review.
5. Run `node docs/wiki/export.mjs --check` for token freshness and local chapter/image links. Then run `node docs/wiki/export.mjs` to prepare `.artifacts/wiki-export/` with GitHub Wiki page links and a SHA-256 file manifest. It copies only Markdown and image-folder assets, not scripts or private inputs.

The source chapters use relative `.md` links so they work in repository browsing. The export removes that suffix for GitHub Wiki page URLs while retaining image paths. Copy the exported files into a local wiki checkout for review; publication is a separate authorized action.

PNG is the published diagram format; editable SVG sources remain alongside it. GitHub documents PNG/JPEG/GIF support and image alt text in its [wiki editing guide](https://docs.github.com/en/communities/documenting-your-project-with-wikis/editing-wiki-content). The export check verifies local files and links; final hosted URL behavior is reviewed in the target wiki when publication is separately authorized.

`Transitions.md` is owned by the staged-navigation implementation until its production contract and measurements are accepted. Do not replace its outstanding evidence with performance claims inferred from layout arithmetic or isolated proofs.
