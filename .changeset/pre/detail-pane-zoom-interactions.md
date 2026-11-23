---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Unify 3XL reading-pane surfaces with theme blur and at least 80% opacity. Join compact summaries to their sections with square lower corners, including glass panels. Release hidden content from interaction during zoom and fade geometry outlines with the interface.

Keep wheel scrolling and model zoom in separate 800ms gestures, route pinch across detail media and summary content to the model, and progressively reveal the page top while zooming. Suppress browser pinch magnification throughout the shell while retaining keyboard/browser-menu zoom.

Hover outlines follow the live device-orientation transform. Zoom reveals the page from the first inward movement and preserves the cursor or pinch anchor across scroll-dependent projection changes. Touch pinch uses one damped dolly path without duplicate OrbitControls pan or zoom.

Keep High-resolution outline sources attached to the live sensor-driven model after refinement, handoff and theme changes. Couple page reveal and interface clearance to one reversible timeline when zoom starts from a scrolled position.

Render the 3XL reading-pane backdrop blur outside the scrolling clip so it actually softens the 3D stage behind all content surfaces. Preserve section colors and at least 80% background opacity without stacking translucent backgrounds.
