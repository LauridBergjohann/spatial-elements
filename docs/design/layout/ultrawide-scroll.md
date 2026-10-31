# Ultra-wide document-scroll proof

Step 10a uses `/proof/ultrawide` as an isolated geometry and browser-behaviour gate. It does not enable the new detail layout or modify the Stage scroll controller.

## Chosen coordinate model

Keep content in ordinary document flow. Its left edge is `availableWidth / 2 + 8`; width is `min(availableWidth / 2 - 28, 1536)`. Reserve 182px before the body and 60px after it. A body of height `B` therefore provides `max(0, B + 242 - viewportHeight)` of document scroll travel. Its content point at offset `d` is visible at `182 + d - scrollY`.

The fixed media area, menu, pane surface, header and submenu do not add document height. The body has no `overflow: auto`, transform, fixed position or independent scroll state. Fragment links and focused inputs keep their native document coordinates; `scroll-padding` declares the fixed obstructions. Short windows below 512px return to normal flow.

The native fallback paints fixed opaque covers above and below the visible pane. The enhanced proof additionally clips the body to the visible viewport region. This changes painting and hit testing, never document height or anchor coordinates. One cached body height from `ResizeObserver` and the document scroll position suffice; there is no layout read on every scroll frame. The focus handler corrects an input only when it falls outside the visible body region.

## Why this comes before a proxy

The existing Stage virtual-document path is useful when moving DOM and projected GPU content together. Making the pane another scroll root would break the author's document-navigation requirement. A native document body avoids translating or reconstructing native anchor coordinates at all. Production integration must compare this native body with the existing frame-synchronised Stage path, preserving the same equation and testing projected content as well as DOM.

The standalone proof does **not** prove Stage/CSS3D clipping, GPU panel ownership, the input split between the free media area and content, a translucent pane surface, or a 2XL/3XL production handoff. Those remain step 10b/10c integration gates. In particular, opaque native covers are not a solution for refracting DOM through GPU glass.

## Evidence

`tests/ultrawide-scroll-proof.e2e.ts` passes three browser cases in Chrome:

- With JavaScript disabled and enabled: real fragment clicks, hash reload, focused inputs outside the initial viewport, Home/PageDown/End, fixed region coordinates, the final line, and `document.scrollingElement` as the only scroll owner.
- Pane widths and midpoint alignment at 2300, 2456, 3128 and 3440px; late content extends native document height by its actual growth; zoom keeps the DOM, input value and scroll position while removing hidden content from interaction; short-height fallback remains normal flow.

Run `SPATIAL_E2E_DEV=1 npx playwright test --config playwright.ultrawide-proof.config.ts` for the isolated development proof, or omit that variable after building the demo. Its dedicated port is 4189. A production-integrated run and real touch/browser-Find/Back-Forward checks remain required; these results do not claim hardware validation.

## Production integration (step 10b/10c)

`SpatialElementPage` keeps one summary and one section-navigation instance. The hero and the document body share a presentation ancestor, retaining the flow-layout summary anchor below 3XL. In the split composition the hero, pane material, pane header and submenu become fixed regions. The summary is ordinary DOM within the document body; its independent Svelte root is preserved when the renderer changes its presentation. The pane material and integrated summary use DOM surfaces. The fixed menu and media controls can still use GPU glass over the scene.

`SpatialElementPaneController` reads the Stage's cached `ResponsiveViewportMetrics`. Its scroll subscription runs after the virtual document translation and before projected panel layout. The controller compensates fixed regions by exactly the virtual scroll amount; `PageBindingController` recognizes their descendants as viewport coordinates and does not subtract that amount again. The body remains in normal flow. Cached body height and document origin determine its clip, without a layout measurement in each scroll frame.

The body declares its visible reading window with `data-stage-scroll-viewport` and `scroll-padding`. Virtual anchor and focus handling uses those obstructions; native fallback retains document navigation and only corrects focused content hidden by fixed pane chrome. JavaScript-enabled rendering clips content and hit testing. JavaScript-disabled rendering uses page-color covers outside the pane, as in the isolated proof; it does not claim GPU refraction through those covers. The only vertical page scroll owner remains `document.scrollingElement`.

Zoom removes pane regions from keyboard interaction while retaining their DOM and scroll position. Returning restores the document position. When crossing the 2XL/3XL composition boundary, a cached reading-section anchor is restored after the new layout rather than retaining a misleading raw scroll number. Media selection and left/right gesture ownership are integrated in step 11.

The public `/demo/layout-pane` fixture and `tests/detail-pane.e2e.ts` exercise production composition, fixed DOM/GPU geometry, real anchors and reload, focus and final-line reachability, late content, one live summary, one navigation instance and zoom/resize retention. Run `npx playwright test --config playwright.detail-pane.config.ts` after the shared production build (port 4193). All three production cases pass in Chrome: JavaScript disabled, native hydration without WebGPU, and real WebGPU. The resize regression preserves the same reading section at 182px in 3XL, 142px in 2XL and 182px on return; the WebGPU case also retains the live input node and value. Fifteen focused Core tests cover the coordinate equation and anchor/focus bounds. Real touch hardware and browser Find remain separate acceptance checks.
