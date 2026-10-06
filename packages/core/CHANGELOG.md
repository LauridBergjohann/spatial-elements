# @spatial-elements/core

## 1.0.0-beta.4

### Minor Changes

- 4b246c1: Add unobtrusive, session-aware 3D interaction guidance with a 40px themed icon button, anchored help, a touch hint and a finite introductory mouse orbit. Add host-supplied interface messages with per-string English fallbacks and document translation/accessibility behavior. Panels support a lift-only hover response and controls that remain available during model close-up.
- c35e335: Refine interaction help with recurring hover prompts until actual model interaction, delayed hover dismissal, a synchronized close-up corner position and submenu-style button highlighting. Render native help popovers with the actual themed panel surface, including WebGPU glass, and reduce the panel pointer approach range.

### Patch Changes

- 004b6e0: Keep the detail help button beside the projected summary edge during zoom, with the same final viewport inset as the minimap. Restore the authored refractive glass edge when an initially hidden popup opens. Display compact, theme-accented mouse/touch diagrams beside localized action labels while preserving complete screen-reader instructions.
- 8e1e137: Keep native help content and its glass surface aligned in every zoom frame. Move the help control closer to the summary and keep its corner inset clear of classic scrollbars.
- 50f73da: Improve touch interaction across collection and detail pages. Carousel model areas coordinate horizontal rotation and vertical page scrolling in the same gesture, with direction changes and damped momentum on both axes. Scrolling outside model areas and two-finger page zoom remain native. Model rotation and pinch gestures release ownership correctly so the next gesture works immediately and background scrolling remains available. Restrict hover effects to mouse input, avoid touch hover raycasts, and coalesce animated rendering with shared scroll updates.
- 432810f: Synchronize the summary panel and help control along a shared close-up path, completing control travel and minimap expansion when the panels finish fading. Add a host-localizable mouse navigation hint with a SpaceMouse link beneath the gesture diagrams.

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
