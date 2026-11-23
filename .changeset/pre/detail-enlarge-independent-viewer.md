---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Decouple 3XL viewer zoom from document scrolling and switch wheel ownership immediately between its separate regions. In stacked layouts, retain scroll/zoom gestures for 380ms, including zoom-out over empty canvas. Correct cursor anchoring so moving the wheel focus no longer drags the model or leaves a stale anchor.

Add animated click/tap enlargement to the UI-clearance endpoint and a centered return from any zoom. Exclude drags, long presses and multi-touch gestures. Move stacked content sections down during zoom, with lightweight blur on nearby sections and breadcrumbs.

Let carousel models overflow inset and transparent section boundaries while respecting full-width backgrounds. Cap inset L sections at 1536px with rounded outer corners and aligned submenus. Zoom retains wheel ownership outside the model from the start of panel clearance; shallow zoom releases it immediately. Outward wheel zoom returns to the fitted stage center independently of pointer position.

Synchronize section movement with the submenu, preserve its 12px viewport inset, and anchor the 3XL pane to the corner controls. Center click enlargement in the entire viewport and let a new click interrupt wheel zoom immediately.

Keep click-to-reset authoritative over residual wheel events and delayed scroll notifications. Reduce repeated responsive-layout calculations and DOM writes in detail and catalog animation frames, reuse render/zoom scratch state, and compare held scene captures numerically without changing rendering quality, motion curves or SpaceMouse connection behavior.

Restore two-finger touch panning at a fixed zoom and while pinching in or out. Keep the grabbed point under the moving touch midpoint through scroll reveal and zoom damping, and release it when returning to one-finger rotation. Preserve mouse zoom-out recentering.

Let empty-stage wheel zoom start as soon as panels begin fading, retaining the gesture through the return to the overview until a 380ms pause. Keep shallow zoom, visible HTML controls and the separate 3XL content region independently scrollable.
