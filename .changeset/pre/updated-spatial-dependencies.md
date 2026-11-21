---
"@spatial-elements/core": minor
"@spatial-elements/sveltekit": minor
---

Adopt Page Sections 0.5.0, Three.js 0.187, SvelteKit 3 and current compatible tooling. Use the maintained @lucide/svelte package. SvelteKit consumers require Node.js 22.17 or newer; repository tooling uses Node.js 24.

Unify spatial cards with Page Sections: replace cardVariant with cardShadow, display supplied descriptions, and preserve responsive card-size allocation unless itemSpan is explicitly supplied. Stretch card placements to equal heights and register the native inner link for keyboard focus, full-card navigation and focus restoration. Keep text and media endpoints separate for 3D transitions. Handle SvelteKit 3 preload errors and shallow navigation hooks without starting spatial route transitions.

Preserve back/forward transitions for history entries carrying shallow metadata. Keep catalog fade captures in the linear working color space and serialize hidden minimap shader preparation for Three.js 0.187.
