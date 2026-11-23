---
"@spatial-elements/core": patch
"@spatial-elements/sveltekit": patch
---

Connect to the local SpaceMouse driver only after explicit activation in the 3D controls help. Cancel pending connections when disabled or disposed, avoiding local-device permission prompts during ordinary detail navigation. Restore keyboard focus after the help panel becomes visible. Enable device orientation for both detail geometry and minimaps on the website.

Restore carousel backdrop blur by clipping overflow without creating a backdrop root. Respect the theme's full tint opacity range and solid surface setting, and keep summary fades from isolating the backdrop. Add browser regressions for sensor motion, explicit driver access and the rendered frosted surface.
