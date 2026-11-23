---
'@spatial-elements/sveltekit': patch
---

Keep stable event targets when cleaning up detail help, carousel and minimap listeners on client-side navigation. This lets cleanup finish even when Svelte has already cleared child element bindings. Skip deferred help focus when its component has already closed or unmounted.
