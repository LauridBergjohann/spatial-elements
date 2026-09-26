# SpatialElement terminology migration

Completed against the pre-release API on 2026-09-26. Spatial Elements describes individual objects and collections, not only commerce products. This is a breaking source API rename before the first npm release; no legacy aliases are retained.

## Consumer changes

| Previous name | Current name |
| --- | --- |
| ProductDetailPage | SpatialElementPage |
| ProductOverviewPage (the existing list wrapper) | SpatialListPage |
| ProductBrandTheme | SpatialTheme |
| ProductDetailData | SpatialElementData |
| ProductStageConfig | SpatialStageConfig |
| ProductOverviewItem | SpatialListItem |
| findProduct / getProductOverviewItems | findSpatialElement / getSpatialListItems |
| ProductAssetManager / ProductLodPair | SpatialElementAssetManager / SpatialElementLodPair |
| product / products props and route-data fields | spatialElement / spatialElements |
| productId / productStage catalog fields | spatialElementId / spatialElementStage |
| core/product-detail/* | core/spatial-element/* |
| productAssets / productLodPair modules | spatialElementAssets / spatialElementLodPair |

Other product-prefixed controllers, contracts, helpers, tests and file names now use SpatialElement. Theme contracts use SpatialTheme, SpatialMinimapTheme, SpatialSectionTheme and SpatialDockedPanelTheme. DOM hooks and CSS variables use spatial-element; detail endpoint slots use detail.hero, detail.summary and detail.dock. Update custom selectors and diagnostics with the consuming application.

~~~svelte
<script lang="ts">
  import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
  let { data } = $props();
</script>
<SpatialElementPage spatialElement={data.spatialElement}>
  <Section section={{ id: 'features', title: 'Features' }}>
    <p>Describe any object, artwork or item here.</p>
  </Section>
</SpatialElementPage>
~~~

## Routes and historical records

The neutral demo uses /demo/elements/[spatialElementId]. Host routes /brand/products/[productId] remain supported, including all existing private brand routes and redirects. Their route parameter is mapped to the spatialElementId runtime identity; public API names do not dictate a host's domain vocabulary. Ordinary product descriptions in the real-brand examples remain legitimate product content.

The private docs/archive directory is an immutable historical record, including its checksums and original names. Active code, asset metadata, generators, tests and current documentation use the new terminology. Existing mesh bytes, asset URL paths and vendor decoder sources are not renamed or regenerated. Historical measurement files outside the archive were relabeled, not remeasured.

## Validation

Package boundary checks reject old API identifiers; tarball checks reject stale output filenames. Both element and host product URL spellings have intent regression coverage in both directions. 

Verified on 2026-09-26 (Windows, Node.js 24, Chrome):

- 222 core unit tests and 41 private application/asset tests passed.
- Package, public-demo and private-app type checks passed without errors or warnings.
- Production builds passed for both applications and an independently installed tarball consumer.
- Six public browser cases passed against workspace packages and again against the isolated tarball consumer.
- Fifteen private browser cases passed in linked mode: all brands, history, SSR, hover feedback and resource cleanup.
- Nine private brand/SSR browser cases passed against actual tarballs, including the Elementbereiche accessibility label.
- All 17 optimized asset reproducibility checks passed. Geometry and poster binaries were not changed.
- All 115 historical archive files retained their checksums; 43 current documentation file links resolved.
- Boundary checks reject old API identifiers and packed-file checks reject stale build artifacts. Package builds now clean their own output before compiling.

The private app is returned to sibling-package links after tarball testing. Existing dependency/build warnings remain as described in the release documentation; no npm publication was performed.
