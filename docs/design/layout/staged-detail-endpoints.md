# Known detail endpoints before route mounting

The shared layout resolver determines the overview's model fit and summary anchor without destination DOM. An ordinary detail link, or `#overview`, therefore has an unambiguous early destination.

A fragment alone does **not** prove that the eventual page is fully docked. Native scrolling clamps on short documents, and an arbitrary heading can remain inside the hero. Those links keep the existing transition until their destination has been restored. There is no stale cache of previous DOM rectangles and no artificial page padding to manufacture a scroll position.

An application may explicitly declare `targetPresentation: 'dock'` through `catalogViewLink`, or on a generated carousel `summary.sectionLink`. This is an authoring contract: the linked section opens the fully docked content view. It does not change routing or scroll semantics. The adapter validates the bound composition before handing off; a violated contract releases the visual hold and reveals the usable destination.

- XS–2XL and the short-height 3XL fallback use the resolver's fixed dock surface and minimap fit.
- Split 3XL keeps the main model on its fixed left stage. The right-side destination is the pane header; no miniature mobile dock is introduced.
- Minimap fit, rotation and element-specific scale travel in the list projection. The numeric target uses actual Low mesh bounds and the shared detail pivot, with the same equations as the mounted minimap.
- Source sensor pose is captured first. Sensor samples pause until the handoff finishes, then recalibrate and recover softly from neutral. A pointer/sensor pose is not guessed for the new detail endpoint.
- During motion only the existing panel surface, heading and eyebrow move into a dock header. Other source content fades away; text is not stretched with the wide, short background surface. Additional destination content belongs to the subsequent reveal.

Implementation and production validation are recorded in the [master plan](../../layout-system-implementation-plan.md). The declaration is optional; ordinary links and no-JavaScript navigation remain useful.
