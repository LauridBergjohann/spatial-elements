---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Improve touch interaction across collection and detail pages. Carousel model areas coordinate horizontal rotation and vertical page scrolling in the same gesture, with direction changes and damped momentum on both axes. Scrolling outside model areas and two-finger page zoom remain native. Model rotation and pinch gestures release ownership correctly so the next gesture works immediately and background scrolling remains available. Restrict hover effects to mouse input, avoid touch hover raycasts, and coalesce animated rendering with shared scroll updates.
