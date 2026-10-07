# @spatial-elements/sveltekit

## 1.0.0-beta.5

### Minor Changes

- 671b2de: Add a themed detail/fullscreen view switch beside 3D help, with localized tooltips and a viewport fallback when the Fullscreen API is unavailable or denied. Fullscreen preserves camera navigation and SpaceMouse, keeps the expanded live minimap and help, and accepts mouse/touch input across the canvas without model picking or hover glow.

  Match the controls' corner radii, restore the fitted view from the detail button and fade its selection with zoom. Project and clip the minimap viewport at its actual size around the shared model center, keeping it stable during orbit. Align the demo header with the brand layouts and keep breadcrumbs visible.

- a0d51dd: Support reactive runtime themes, optional HDR backdrop overrides and resolved color schemes without resetting element interaction. Export a reusable controlled ButtonGroup and use it for the detail/fullscreen switch. Add shell-owned light, dark and system examples with session preference persistence.

### Patch Changes

- 07f10a9: Keep stable event targets when cleaning up detail help, carousel and minimap listeners on client-side navigation. This lets cleanup finish even when Svelte has already cleared child element bindings. Skip deferred help focus when its component has already closed or unmounted.
- a0d51dd: Keep detail summary panels sticky only within their hero section, synchronizing their surface and content clipping during scroll. Size summaries from their content so long titles, wrapped features and late font changes remain inside the panel. Prevent fullscreen corner controls from pinning summary panels during ordinary page scrolling.
- Updated dependencies [671b2de]
- Updated dependencies [a0d51dd]
- Updated dependencies [a0d51dd]
  - @spatial-elements/core@1.0.0-beta.5

## 1.0.0-beta.4

### Minor Changes

- 4b246c1: Add unobtrusive, session-aware 3D interaction guidance with a 40px themed icon button, anchored help, a touch hint and a finite introductory mouse orbit. Add host-supplied interface messages with per-string English fallbacks and document translation/accessibility behavior. Panels support a lift-only hover response and controls that remain available during model close-up.
- c35e335: Refine interaction help with recurring hover prompts until actual model interaction, delayed hover dismissal, a synchronized close-up corner position and submenu-style button highlighting. Render native help popovers with the actual themed panel surface, including WebGPU glass, and reduce the panel pointer approach range.

### Patch Changes

- 004b6e0: Keep the detail help button beside the projected summary edge during zoom, with the same final viewport inset as the minimap. Restore the authored refractive glass edge when an initially hidden popup opens. Display compact, theme-accented mouse/touch diagrams beside localized action labels while preserving complete screen-reader instructions.
- 8e1e137: Keep native help content and its glass surface aligned in every zoom frame. Move the help control closer to the summary and keep its corner inset clear of classic scrollbars.
- 50f73da: Improve touch interaction across collection and detail pages. Carousel model areas coordinate horizontal rotation and vertical page scrolling in the same gesture, with direction changes and damped momentum on both axes. Scrolling outside model areas and two-finger page zoom remain native. Model rotation and pinch gestures release ownership correctly so the next gesture works immediately and background scrolling remains available. Restrict hover effects to mouse input, avoid touch hover raycasts, and coalesce animated rendering with shared scroll updates.
- 432810f: Synchronize the summary panel and help control along a shared close-up path, completing control travel and minimap expansion when the panels finish fading. Add a host-localizable mouse navigation hint with a SpaceMouse link beneath the gesture diagrams.
- Updated dependencies [004b6e0]
- Updated dependencies [4b246c1]
- Updated dependencies [c35e335]
- Updated dependencies [8e1e137]
- Updated dependencies [50f73da]
- Updated dependencies [432810f]
  - @spatial-elements/core@1.0.0-beta.4

## 1.0.0-beta.3

### Performance

- Bound rendering resolution and intermediate render targets, reuse prepared resources and reduce work during scrolling and page transitions.

### Major Changes

- 798ca43: Require geometry.low and geometry.high on element data instead of glb and optional lodPair. Normalize identical URLs to shared cached resources and support URL-only geometry without generated bounds. Require ContentPage.hdr and SpatialListPage.hdr explicitly instead of inferring category lighting from the first element. Update examples, tests and migration documentation.
- 798ca43: Simplify authoring around flat SpatialElementData and shared SpatialTheme. Remove SpatialStageConfig and BrandStageShell stage/catalog props, register page-owned data automatically, project list assets without includeStage, and provide createSpatialTheme plus optional content defaults. See docs/configuration-migration.md and docs/getting-started.md before upgrading.

### Minor Changes

- 798ca43: Update the supported Three.js peer to ^0.186.1. Applications must upgrade their shared
  Three.js installation; TypeScript consumers should use @types/three 0.186.0.

### Patch Changes

- Updated dependencies [798ca43]
- Updated dependencies [798ca43]
- Updated dependencies [798ca43]
  - @spatial-elements/core@1.0.0-beta.3

## 0.1.0-beta.2

### Patch Changes

- 2f9957d: Clarify automatic Three.js peer installation and automate coordinated npm releases through GitHub Flow.
- Updated dependencies [2f9957d]
  - @spatial-elements/core@0.1.0-beta.2

## 0.1.0-beta.1

First public beta: spatial content, progressive rendering and prepared navigation.
