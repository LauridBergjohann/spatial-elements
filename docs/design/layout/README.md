<img src="../../../apps/website/static/spatial-elements-logo.svg" alt="Spatial Elements logo" width="64" />

# Responsive layout contract

This directory is the canonical engineering specification for the responsive layout redesign. The implementation follows the [incremental plan](../../layout-system-implementation-plan.md). Measurements are CSS pixels, not device pixels.

## Sources and decisions

The author's Figma exports and explanatory PDF were updated on 31 October 2026. [sources.json](sources.json) records their names, exact byte sizes and SHA-256 checksums. Originals are archived in the private `spatial-elements-brand-examples` repository at `docs/design/layout/source/`; readable per-layout reference sheets accompany that archive. The public framework does not require that repository to build or test. Public illustrations use the framework's original demo assets.

Precedence: the author's explicit corrections, then this consolidated contract, then original annotations. A screenshot is a reference, not a second configuration source. The source archive deliberately retains contradictory original labels; the resolutions below are authoritative.

- [Content layout](content-layout.md): container grids, typography, cards, section backgrounds, radii and authoring contracts.
- [Detail layout](detail-layout.md): shell, hero, rail, summary, docking, zoom, carousel and ultra-wide composition.
- [Validation cases](validation.md): fixtures, measurable invariants and acceptance scenarios.
- [Device-review corrections](detail-feedback-corrections.md): mobile return transitions, live summary ownership, touch scrolling, hero/dock bounds and continuous 3XL pane zoom.
- [Staged reveal opacity](staged-dom-reveal.md): local DOM paint ownership, ordinary-transition fallback and cleanup during the experimental forward path.

## Decision record

| ID | Decision | Reason / provenance |
| --- | --- | --- |
| D01 | Seven viewport layouts, four independent container grids | Author specification; ultra-wide composition must not require more authored content variants. |
| D02 | Content cap 1536px, including layout L | Author correction; maintain readable content widths. |
| D03 | 3XL pane left `W/2 + 8`; width `min(W/2 - 28, 1536)` before safe-area adjustments | Author's midpoint rule plus corrected width table (1122px at W2300; 1200px at W2456). These imply a 20px right inset before the cap; the older drawing's 28px outer annotation cannot also define the pane's right edge. Use this single formula rather than retaining contradictory endpoints. |
| D04 | Carousel 3XL uses the 2XL composition; summary width 480px | Author correction. Do not use the narrow 3XL detail grid to size a carousel. |
| D05 | Large-grid carousel padding 24px; headline gap 16px | Author correction; same rhythm as ordinary sections. |
| D06 | Natural summary heights; preserve source height through motion | Author decision; arbitrary content cannot have an exact predicted destination height. |
| D07 | Preserve live panel component ownership, not merely a DOM node | Required for reactive snippets, input state and teardown across route commit. Prove in a dedicated integration before adoption. |
| D08 | Freeze source query width during motion; reflow in content phase | Engineering consequence of D06/D07; live DOM must not cause per-frame layout work or text distortion. |
| D09 | One document scroll owner in 3XL | Author decision; native anchors, history and keyboard scrolling must continue working. |
| D10 | Card L spans three columns in grid S; S title 9px | Author corrections override old four-column / 8px labels. |
| D11 | Grid M headline line-height 32px | PDF and dimension line agree; the image's 28px text label is stale. |
| D12 | A gradient requires an effectively full-width background | Author decision. Detail pages constrain full backgrounds; unsupported gradients normalize to their final color with a development diagnostic. This is the documented engineering normalization, avoiding rounded gradient seams. |
| D13 | Tiny cards reserve text space and shrink the 4:3 fit area proportionally | Engineering resolution of text line-height versus square-card size; never distort media or silently shrink type. See content contract for the exact budget. |
| D14 | Stable DOM menu surface on ordinary ContentPages | Canvas-only refraction cannot include underlying HTML. The host still supplies menu contents. |
| D15 | Expected discrete grid reflow; no resize animation | Stable text and selection are more important than animating window resizing. Test orientation, zoom and split-screen. |
| D16 | Images/videos replace the 3D scene background; navigation returns to 3D | Author decision; media choice is transient rather than history state. |
| D17 | Gestures belong to the initial target; native and embedded controls take precedence | Avoid mid-gesture reassignment. Cross-origin video players own their internal input events. |

## Shared implementation rules

The pure core resolver describes geometry and constraints. CSS and TypeScript derive their breakpoints and tokens from one source. Content width includes section padding; the query container is outside that padding. An authored block's logical order is also its DOM and keyboard order.

Natural height is represented as natural height plus an optional maximum, never an invented exact rectangle. Existing source measurements are allowed. Destination DOM measurement must not become a prerequisite for early forward motion.

Safe areas are non-negative CSS insets applied once. Layout selection uses the CSS viewport width; content geometry uses the available inset rectangle. The stable layout height is an input supplied by the existing viewport owner. Physical screen size and DPR do not select layout classes. Real orientation changes invalidate that input; mobile address-bar animation must not repeatedly resize the 3D stage.

Classic scrollbars need a separate input: media queries use `window.innerWidth`, while percentage-based content can have less available space. Pass the reserved scrollbar/gutter width separately; do not substitute `documentElement.clientWidth` for both quantities. Centered geometry and the pane midpoint use the layout width after this reserved strip, then apply safe-area insets. For example, a 1600px viewport with a 15px reserved gutter still selects XL, with a 1313px content container at x=136.

For unusually short windows, preserve control sizes and let flow content scroll. Clamp fit-area dimensions to non-negative available sizes; never generate inverted rectangles. A fixed 3XL shell must leave a usable content window or use the normal document-flow fallback for insufficient height. The fallback is a height constraint, not another width breakpoint.

## Ownership and API migration

Core owns arithmetic and layout tokens. SvelteKit owns semantic HTML, SSR, container queries, slots and persistent component instances. The stage owns GPU resources and projection. The host owns navigation/menu contents, element data, translation, theme preference and application actions.

New authoring settings are additive while migrating existing demos. Legacy appearance fields remain explicitly mapped until their replacements are documented. Do not silently remove content, duplicate interactive controls, or make the fallback depend on JavaScript registration.

The plan's implementation checklist records commits and checks. This specification is updated before an implementation changes one of its invariants; published author documentation then explains the accepted behavior rather than the discarded alternatives.
