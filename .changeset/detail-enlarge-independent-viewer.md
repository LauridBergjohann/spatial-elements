---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Decouple 3XL viewer zoom from document scrolling and switch wheel ownership immediately between its separate regions. In stacked layouts, retain scroll/zoom gestures for 320ms, including zoom-out over empty canvas. Correct cursor anchoring so moving the wheel focus no longer drags the model or leaves a stale anchor.

Add animated click/tap enlargement to the UI-clearance endpoint and a centered return from any zoom. Exclude drags, long presses and multi-touch gestures. Move stacked content sections down during zoom, with lightweight blur on nearby sections and breadcrumbs.

Let carousel models overflow inset and transparent section boundaries while respecting full-width backgrounds. Cap inset L sections at 1536px with rounded outer corners and aligned submenus. Only immersive zoom retains wheel ownership outside the model; shallow zoom releases it immediately. Outward wheel zoom returns to the fitted stage center independently of pointer position.

Synchronize section movement with the submenu, preserve its 12px viewport inset, and anchor the 3XL pane to the corner controls. Center click enlargement in the entire viewport and let a new click interrupt wheel zoom immediately.
