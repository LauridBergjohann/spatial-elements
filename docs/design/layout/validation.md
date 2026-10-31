# Layout validation fixtures

Fixtures use procedural public demo assets. The private examples add real-world content, but are not dependencies of public package tests.

## Geometry

Pure resolver cases cover widths immediately below, at and above 600, 840, 1200, 1600, 1809 and 2300; fractional widths; the 1536 content cap; 2456 where the detail pane reaches grid L; and 3128 where the pane reaches its cap. At 3840 the pane is still anchored at 1928px and remains 1536px wide. A normal ContentPage/carousel at that width still uses the centered full content composition.

Container-grid cases independently use 320, 599.5, 600, 839.5, 840, 1199.5, 1200 and 1536px. At 840px, section padding must not accidentally change grid M into grid S. Sum of columns, gutters and two margins must reproduce the supplied container width. Card L in grid S must fit exactly twice per row.

Heights include short, typical and tall viewports, zero/invalid inputs, asymmetric safe areas, orientation changes and mobile browser chrome. Coordinates are finite. Known layout anchors agree with browser rectangles within one CSS pixel; natural heights are checked against their limits instead of exact predictions.

## Authored content

| Fixture | Contents | Checks |
| --- | --- | --- |
| Grid reference | Explicit spans in all four grid sizes, nested narrow container | Container rather than viewport queries; DOM order; no duplicate padding |
| Sections | With/without headline; all solid/gradient backgrounds; alternating and grouped surfaces | Accessible section names, effective full-width normalization, group corners |
| Cards | Every card size; short/long titles; mixed eyebrows; centered/start text | Square cards, contained 4:3 media, line budgets, complete accessible names |
| Small cards | 320px viewport and large text settings | Text remains readable; fit region shrinks proportionally; no overlapping links |
| Summary | No features/CTA; many features; custom input, variant selector, counter | Natural height/overflow; state and node identity across binding; exact cleanup |
| Detail content | 0, 1 and many sections; delayed images/fonts; very long labels | Anchors, subnavigation overflow, reachable final content, no layout jumps at handoff |
| Media | 3D, portrait/landscape image, missing image, native video, embedded video | Containment, selection, transient media state, playback teardown, correct input owner |
| Ultra-wide | Short and long pane content; deep hash; zoom; layout resize | Document scrolling, fixed left stage, focus/find/history, pane cap and preserved reading position |

## Navigation and presentation

1. Direct SSR load with JavaScript disabled and with scripts delayed; enable enhancement without moving existing anchors or duplicating controls.
2. List and carousel to detail, top and known dock target; separately test the fixed-stage 3XL destination.
3. Warm hover prefetch, immediate click without hover, cold route modules, slow/failed requests, rapid replacement navigation and browser back/forward.
4. A custom summary keeps its instance, values and effects through the motion/commit/handoff sequence; cleanup happens once. Focus follows navigation intentionally rather than disappearing during DOM transfer.
5. Keep source query width stable while simulating one-to-two/three-column destination changes and late font/data delivery. No repeated content layout during the motion phase.
6. Main menu at scroll 0, 48, 112, 140, 300 and back to 0; 3XL detail stays fixed. Test a route change while both pages are at top.
7. Reduced motion, light/dark, glass/non-glass, unavailable GPU, touch, mouse and hybrid/stylus input. Sensor pause and post-scroll recalibration remain intact.

## Evidence and gates

Unit tests establish the mathematical invariants; browser tests establish actual geometry and behavior. Screenshots document appearance but do not replace these assertions. Performance uses production builds and reports separate cold/warm distributions, not a single best run. Required device tests unavailable to automation are recorded as outstanding, never marked passed.

Per step record its commit, command, result and relevant screenshots/traces in the implementation plan. Full release and package-consumer checks run after integration; do not repeat every expensive check for documentation-only edits.
