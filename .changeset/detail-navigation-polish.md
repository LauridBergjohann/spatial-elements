---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Fix responsive catalog return transitions, preserve live summary panel state and typography, and allow native touch scrolling over detail panels and media rails. Keep docked geometry visible at the viewport edge, contain wide models within the stage focus area, and ease the 3XL content pane away during zoom. Align detail controls and breadcrumbs with the shared layout contract.

Load individual icons instead of the icon barrel to reduce development startup work. The repository now provides separate Basics and Showcase applications, with independent development, build and preview commands and a persistent light/dark Showcase navigation shell.
