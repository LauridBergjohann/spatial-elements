---
"@spatial-elements/core": patch
"@spatial-elements/sveltekit": patch
---

Start catalog navigation sooner by deferring future scroll-quality and close-up shader warmups until after the transition. Avoid unnecessary layout reads for resting corner controls and batch computed-style snapshots without dropping authored styles.

Show immediate, persistent navigation feedback before transition preparation. Keep it visible across route binding, remove it when motion begins, and clean it up on cancellation, superseding navigation or device loss. Preserve transition timing, reduced-motion behavior and semantic fallback navigation.
