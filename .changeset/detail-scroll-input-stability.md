---
"@spatial-elements/core": patch
"@spatial-elements/sveltekit": patch
---

Keep detail docking and minimap rendering continuous across scrolling and viewport changes. Preserve device tilt when photographs are selected, retain native rotation and screen-space panning sensitivity at every zoom level, and support two-axis trackpad panning only after panels fully clear, in fullscreen, or over the separate 3XL stage, including its empty background. Conservatively distinguish trackpad gestures: confirmed two-finger input scrolls or pans, pinch zooms, and uncertain input retains mouse zoom without panning. Keep gesture ownership stable and preserve mouse and touch navigation. Prevent viewport refits from triggering page reveal and keep section layout stable during scrollspy updates. Use a reversible minimap dock boundary, feather departing content beneath the scroll header, conceal breadcrumbs beneath glass navigation, and distinguish wheel inertia from fresh input when handing off between scroll and zoom.
