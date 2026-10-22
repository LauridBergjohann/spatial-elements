# Responsive catalog navigation

Catalog handoffs prepare the visible full-quality frame before motion. Scroll-quality target warmups and hidden close-up/minimap shader compilation are deferred until after the transition's final frame has had a paint opportunity. Direct detail entry and already-focused presentations retain eager preparation. Ordinary rendering still prepares effects on demand, so an immediate zoom does not depend on the optional warmup completing.

Deferred work is tied to the current page binding. Releasing the page cancels queued frames, and a new active transition prevents queued warmups from starting. Completion from a stale or disposed page cannot invalidate the current renderer. Failed optional warming is reported without abandoning the live page.

Resting corner controls return their zero focus offset without reading the document width. Zoomed layouts retain the existing scrollbar and minimap collision measurements. Transition snapshots retain all computed properties, including custom properties and SVG styles, but apply them with one CSS text assignment per detached clone instead of hundreds of individual mutations.

The persistent stage shows a thin navigation indicator on accepted same-brand page navigation. It paints before synchronous transition capture and remains visible across route commit and GPU binding. It disappears at the first moving frame, or on ordinary completion, cancellation, superseding navigation, device loss or teardown. Reduced motion uses a static indicator. Native/no-JavaScript links are unchanged.

## Local measurement

Production Chrome/WebGPU, 1440 × 900, DPR 1, Wurm list → ASV101 detail, three fresh contexts after 1.8 seconds of hover. The animation timestamp is the first RAF observation of the animation phase, not a pixel-level presentation timestamp.

| Measurement | Before | After |
| --- | --- | --- |
| Click → observed animation | 1405–1593 ms | 619–928 ms |
| Median click → animation | 1408 ms | 695 ms |
| Click → observed navigation feedback | No spinner frame observed | 36–75 ms |
| Hidden zoom pipeline compilation | Before animation | After handoff |

These are local diagnostic samples, not cross-device guarantees. The remaining delay includes DOM capture/mounting and submission of the required first GPU frame. Transition timing and motion curves are unchanged.

## Regression coverage

- Unit tests cover deferred-work ownership, cancellation and the acknowledgement paint barrier; resting controls must not read layout.
- Brand-example browser tests hold destination binding after route commit to verify continuous acknowledgement, then immediately zoom. GPU instrumentation checks that optional asynchronous pipeline compilation starts outside capture/motion, in both mobile and desktop widths.
- Existing header, transition-paint, interruption, history and fallback tests protect the unchanged navigation behavior.
