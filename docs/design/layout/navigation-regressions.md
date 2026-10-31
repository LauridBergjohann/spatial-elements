# Ordinary-navigation layout regression evidence

This checkpoint tests the existing navigation path on the new layouts. It does not enable the query-gated early transition or substitute for its separate motion, cancellation and performance gates.

## Corrected integration failures

- A departing route can detach a tab-navigation restore parent. Use the state-preserving DOM move only when document and connection state permit it; otherwise use ordinary insertion with a valid sibling reference. The single live navigation instance remains the contract.
- Carousel activation focuses its link with `preventScroll`. The virtual-scroll focus handler must also respect pointer activation: it previously centered a visible link whose bottom lay just outside its 24px comfort margin, changing source scroll from 0 to 197px before navigation captured history. Pointer association now survives the complete click task, including delegated Svelte listeners; keyboard focus still reveals obscured controls. A microtask alone is insufficient because browsers can run it between native event listeners.
- Detail help controls now resolve their summary anchor from the shared detail root. The summary is a sibling of the media hero after the pane composition change. Looking only inside the hero left the anchor undefined and separated the control and projected panel during zoom.
- A theme tint represented by a Three.js color is converted to a CSS color string before assigning the native pane custom property.
- The final short section becomes active at the document end when it is visible, even if it cannot reach the normal activation line. Non-scrolling pages keep their ordinary initial selection; 3XL uses its actual pane reading bounds.
- Zero-area source frames no longer produce 1px GPU/native surfaces. XS/S submenu visibility survives portaling. When a page first opens narrow and later enters M, the same live submenu is measured synchronously without painting it; renderer-owned temporary styles are restored before returning.
- Keyboard focus on fixed overlays preserves document scroll. The centered dock hit area can extend slightly above the viewport; scrolling the document cannot reveal that fixed control and previously deactivated it before Space could activate it. Ordinary obscured body controls still scroll into view.

## Functional checks

Chrome-channel production runs were performed serially on Windows. Viewports are CSS pixels; none of these checks claims real-device sensor behavior or a universal frame-time budget.

| Check | Recorded result |
| --- | --- |
| Pointer focus (mouse, touch, pen), keyboard reveal, existing virtual-scroll/dock units | 7/7 pass |
| Public list/carousel/fragment navigation with Back/Forward at 430, 1440 and 2456px | 6/6 pass |
| Public projected summary/control gap throughout partial zoom | 1/1 pass |
| Private Wera/Watches controls, translations, partial/full zoom, popup projection | 2/2 pass |
| Private Wera/Wurm/Watches header continuity, cold and warmed navigation plus History | 3/3 pass |
| Private host production build and Svelte check | Build passes; 0 errors, 0 warnings |
| Empty-frame culling and final-section selection units | 22/22 pass |
| XS→M→S live submenu identity/culling; short final section in flow/3XL, native and WebGPU | 3/3 pass |
| Private header continuity, SSR/WebGPU frame matrix, help and theme regression follow-up | 21/21 pass |
| Fixed-overlay focus and pane viewport focus/anchor rules | 6/6 pass |
| Private visual migration, initial complete candidate run | 48 pass / 12 fail; all failures investigated |
| Private targeted follow-up, including the rejected Section image | 11 pass / 2 fail across 13 cases |
| Remaining minimap keyboard-focus and exact render-counter cases after correction | 2/2 pass |
| Manually reviewed private screenshot baselines | 25/25 approved; hashes match the inspected candidates |

The final public history matrix includes the pointer task-lifetime correction. The controls and private header runs were already green before that correction and are unaffected by its release timing.

Header tests observe every frame of both the bounded-preparation fallback and the real transition. A warm run must contain more than five actual transition frames; it cannot pass merely because the transition was skipped. The 500ms production preparation limit is unchanged. Tests wait for the complete feedback lifetime: a missing transition attribute alone is insufficient when capture has fallen back but destination binding is still running.

## Reproduction

Build the framework and public demo once, then run:

```powershell
npx playwright test --config playwright.layout-navigation.config.ts
npx playwright test tests/interaction-help.e2e.ts --grep 'corner controls preserve'
npx vitest run packages/core/src/stage/VirtualScrollController.focus.spec.ts packages/core/src/stage/VirtualScrollController.spec.ts
```

In the private host, build against those same local packages and run its `playwright.layout-regression.config.ts` with the header-continuity and interaction-help files. The configuration deliberately does not build in parallel with browser testing. Header tests save phase/timing evidence alongside their results.

The private visual migration retains all 60 scenarios and all 25 named screenshot assertions. The initial 48 passing cases, successful targeted corrections and final two-case run provide coverage across successive coordinated checkpoints; this is not a claim that a second complete 60-case suite ran on the final build. The final private build and two cases use runtime `1b1aadd`, including fixed-overlay focus fix `6931b07`. The private repository's `docs/layout-migration.md` records the replaced assumptions, evidence paths and remaining authored-media data needs.

Staged-navigation performance and cancellation gates remain separate. Rapid Back during unfinished destination binding is a separate cancellation case; this ordinary-history matrix waits for binding to complete before going Back.
