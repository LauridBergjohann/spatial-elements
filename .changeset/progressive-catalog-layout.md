---
'@spatial-elements/core': patch
'@spatial-elements/sveltekit': patch
---

Render carousels as native horizontal scroll-snap rails before WebGPU is ready, keeping their intrinsic dimensions and selected summary position during enhancement. Preserve fallback selections and native detail links, fade posters into prepared GPU output, and align initial document and theme styles. Carousel hover and keyboard focus now smoothly remove model defocus and expose the complete element identity through a tooltip.
