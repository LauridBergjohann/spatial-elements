# Website assets

- `showcase/<product-id>/`: the product's lightweight and detailed GLBs, rendered
  WebP poster, and numbered WebP photographs with smaller responsive variants.
- `environments/studio.hdr`: the shared 1024 × 512 showcase lighting environment.
- `draco/gltf/`: the locally served Draco decoder used by compressed models.
- `demo/`: generated examples copied from `fixtures/demo-assets` during builds;
  these files are ignored by Git.

Product descriptions, media and presentation settings are authored in
`apps/website/src/lib/showcase`. Original product files remain outside the website
in the author's source library. They are not copied into deployed output.

See `tooling/asset-pipeline/README.md` for reproducible model, photo and poster
generation and quality checks, and `ATTRIBUTION.md` for asset provenance.
