# @spatial-elements/core

## 1.0.0-beta.3

### Performance

- Bound rendering resolution and intermediate render targets, reuse prepared resources and reduce work during scrolling and page transitions.

### Major Changes

- 798ca43: Require geometry.low and geometry.high on element data instead of glb and optional lodPair. Normalize identical URLs to shared cached resources and support URL-only geometry without generated bounds. Require ContentPage.hdr and SpatialListPage.hdr explicitly instead of inferring category lighting from the first element. Update examples, tests and migration documentation.
- 798ca43: Simplify authoring around flat SpatialElementData and shared SpatialTheme. Remove SpatialStageConfig and BrandStageShell stage/catalog props, register page-owned data automatically, project list assets without includeStage, and provide createSpatialTheme plus optional content defaults. See docs/configuration-migration.md and docs/getting-started.md before upgrading.

### Minor Changes

- 798ca43: Update the supported Three.js peer to ^0.186.1. Applications must upgrade their shared
  Three.js installation; TypeScript consumers should use @types/three 0.186.0.

## 0.1.0-beta.2

### Patch Changes

- 2f9957d: Clarify automatic Three.js peer installation and automate coordinated npm releases through GitHub Flow.

## 0.1.0-beta.1

First public beta: spatial content, progressive rendering and prepared navigation.
