---
'@spatial-elements/core': minor
'@spatial-elements/sveltekit': minor
---

Add a themed detail/fullscreen view switch beside 3D help, with localized tooltips and a viewport fallback when the Fullscreen API is unavailable or denied. Fullscreen preserves camera navigation and SpaceMouse, keeps the expanded live minimap and help, and accepts mouse/touch input across the canvas without model picking or hover glow.

Match the controls' corner radii, restore the fitted view from the detail button and fade its selection with zoom. Project and clip the minimap viewport at its actual size around the shared model center, keeping it stable during orbit. Align the demo header with the brand layouts and keep breadcrumbs visible.
