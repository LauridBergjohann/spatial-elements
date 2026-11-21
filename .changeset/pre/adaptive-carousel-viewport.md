---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Fit carousel visibility and preparation to the actual viewport instead of a fixed five-seat window. Space neighbouring models using their display envelope, maintain ordering on wide screens, and share visibility between GPU models, posters and hit targets. Scope detail framing styles to the hero so preloading a detail route cannot enlarge carousel geometry.

Keep compact side previews in the model area as they recede, clear of the summary below.

Give transition playback its own bounded safety window after route and shader preparation, preventing slow preparation from cancelling the first animation frames.
