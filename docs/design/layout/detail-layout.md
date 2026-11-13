# Detail, shell and carousel layout contract

This is the geometric contract for the shared layout resolver, native HTML and stage projection. Source precedence and source hashes are recorded in [README.md](README.md) and [sources.json](sources.json). The source is the updated `Layout.png`, explanatory PDF pages 4–10 and the author's subsequent corrections. Values explicitly identified as **engineering normalization** resolve incomplete or conflicting annotations; they are not additional measurements supplied by the author.

## Coordinates and arithmetic

All dimensions are CSS pixels and border-box dimensions. Select the viewport layout using the CSS viewport width before safe-area subtraction: XS `<600`, S `[600,840)`, M `[840,1200)`, L `[1200,1600)`, XL `[1600,1809)`, 2XL `[1809,2300)`, 3XL `>=2300`.

The formulas below describe the safe-area-adjusted rectangle. `W` is its width, `H` its stable height, and `(0,0)` its top-left. Add the safe-area origin to obtain viewport coordinates. Insets are applied once. At zero safe areas these are exactly the design coordinates. The exception is the author's explicit 3XL midpoint anchor: that uses the full CSS viewport midpoint plus 8px; apply the right safe inset after the 20px outer margin without shifting this anchor. `H` comes from the existing stable viewport owner, not a fresh visual-viewport height on every mobile browser-toolbar animation. A real orientation change invalidates the stable dimensions.

`C` denotes the normal content-container width, including section padding. `L = (W-C)/2` is its left edge. `p`, `g`, `n`, `col` and `span(k)` use the [content-grid contract](content-layout.md):

```text
col     = (C - 2p - (n - 1)g) / n
span(k) = k * col + (k - 1)g
colX(i) = L + p + (i - 1) * (col + g)  // one-based column

normal C:
XS–L = min(W, 1536)
XL   = min(max(0, W - 272), 1536)
2XL+ = min(W, 1536)
```

Choose the content grid from `C` **before** padding. Do not choose it from the viewport or subtract padding twice. Preserve fractional positions in the resolver; rasterization may round them. Final rectangles have non-negative widths/heights. Surface borders and shadows do not add to the declared box.

The 3XL detail pane has its own `C`; an ordinary ContentPage and a carousel at 3XL continue using the normal 1536px container. Width and height constraints are separate from actual intrinsic content heights.

## Shell and breadcrumbs

| Layout | Menu left / width | Initial top | Menu height | Breadcrumb height / font size |
| --- | --- | --- | --- | --- |
| XS, S | `0 / W` | 0 | 66 | 24 / 10 |
| M | `0 / W` | 0 | 66 | 30 / 12 |
| L | `0 / W` | 0 | 66 | 40 / 14 |
| XL | `L / C` | 16 | 64 | 40 / 14 |
| 2XL, 3XL | `L / C` | 16 | 64 | 40 / 14 |

The large menu has 12px top/bottom padding around 40px controls. The full-width menu of L is independent of the corrected 1536px **content** cap. A normal breadcrumb follows the menu's document reservation: its bottom is 90px in XS/S, 96px in M, 106px in L, and 120px in XL/2XL. ContentPages at 3XL use the ordinary shell; detail 3XL places the breadcrumb inside the pane header instead.

Satellites are available from XL: each group is 80×40, initially at `(28,28)` and `(W-108,28)`. The 28px outer alignment is explicit in the separate shell diagrams; it is not the variable rail inset. Their gap to the centered menu becomes variable at 2XL/3XL. Below XL the application must expose the same actions through its menu contents.

The shell owns all of these boxes and their surfaces; the host owns their semantic content and actions. Host content must fit the supplied region or use its own menu/popover. It must not silently enlarge the shell. The breadcrumb is one line, horizontally scrollable, with its final item revealed. Native focus scrolling must remain available. In detail 3XL only the current page label is omitted; retain the final separator because the title is on the next line.

The persistent menu and satellites share the following scroll rule, with the sticky range shortened to 32px by the author:

```text
menuY(scrollY) = initialY - max(0, scrollY - 32)
```

This is a bounded sticky range, not a direction-sensitive reveal rule. Scrolling upward far below 32px does not immediately reveal it. **Detail 3XL is fixed** at its initial position. Native sticky and the enhanced scroll bridge must not apply this translation twice. Persistent shell ownership must prevent a header gap during route transitions.

## Detail hero, XS through 2XL

The green rectangle is the media-fit target, not the canvas extent. The 3D canvas and scene background cover the viewport. Geometry in its prescribed pose, images and videos fit completely into the target while preserving aspect ratio. The separate source controls overlay its upper-right corner; do not subtract their width from the fit target.

Let `T` be the rail thumbnail size, `R` the rail left edge, `P` the summary width, `PR` the summary right edge, `Y` the hero top and `F` the hero fit height.

| Layout | `Y` | `F = clamp(min, H-offset, max)` | `T` | `R` | Rail item gap | Summary `P` | Summary `PR` | Stage left | Stage right |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| XS | 90 | `clamp(150,H-214,400)` | 80 | 8 | 8 | `W-16` | `W-8` | 8 | `W-8` |
| S | 90 | `clamp(150,H-214,500)` | 80 | 8 | 8 | `W-16` | `W-8` | 8 | `W-8` |
| M | 96 | `clamp(300,H-180,500)` | 80 | 8 | 12 | `span(3)` | `W-8` | 96 | `PR-P-8` |
| L | 106 | `clamp(340,H-194,600)` | 80 | 8 | 16 | `span(4)` | `W-24` | 96 | `PR-P-8` |
| XL | 120 | `clamp(400,H-236,700)` | 112 | 12 | 16 | `span(4)` | `W-12` | 136 | `PR-P-8` |
| 2XL | 120 | `clamp(400,H-216,800)` | `min(0.07W,138,max(0,L-32))` | `L-24-T` | 24 | 480 | `W-R` | `L` | `PR-P-24` |

The min/max/offset numbers are the explicit green/blue height annotations. Do not recompute them from the content height. In L, calculate `span(4)` from the corrected capped container even when `W>1536`. In XL, calculate it from `W-272`, not from `W`. At 2XL the **original unscaled rail annotation is 138px**, not 136px; 136px is the different XL outer band. The corresponding large-grid summary width is exactly `(1536-13*24)/12*4+3*24 = 480`.

**Engineering normalization at the lower 2XL boundary:** the outer band is too narrow for the original rail-size formula at 1809px. Limit `T` additionally to `max(0,L-24-8)`, then keep `R=L-24-T`. This preserves the 24px rail-to-stage gap, an 8px minimum outer inset and all content/stage anchors. At 1809px the thumbnail is 104.5px; it grows to the ordinary 7%-of-width/138px limit as space becomes available. Clamping only `R` would push the rail into the stage gap.

| Region | Vertical formula | Overflow | Owner |
| --- | --- | --- | --- |
| Stage, XS–2XL | `[Y,Y+F]` | Background may cover viewport; media fit preserves proportions | Core rectangle; stage projection/native media |
| Rail, XS/S | `(8,Y+F+8,W-16,80)` | Local horizontal scrolling, no wrapping | MediaRail |
| Rail, M–2XL | `(R,Y,T,F)` | Local vertical scrolling, no wrapping | MediaRail |
| Summary, XS/S | `(8,Y+F+96,W-16,naturalHeight)` | Document flow, no height cap | Persistent summary host; detail layout slot |
| Summary, M–2XL | Left `PR-P`, top `Y`, width `P`, `maxHeight=F` | Local vertical scrolling only when natural height exceeds `F` | Persistent summary host; detail layout slot |
| Detail content, XS/S | After the natural summary and its section spacing | Document scrolling | SpatialElementPage/Section |
| Detail content, M–2XL | After the hero and submenu region below | Document scrolling | SpatialElementPage/Section |

For XS/S the `96` is `8 + 80 + 8`: stage-to-rail gap, rail, rail-to-summary gap. No fabricated summary height may be used to calculate subsequent section positions. The following section begins after the natural summary and supplies its own top padding. The illustration's 12px below-summary label matches XS section padding; in S the authoritative grid padding is 16px. Do not add a second 12px spacer to the section padding.

The rail always starts with the first 3D view, which is also the minimap. Images preserve their own aspect ratio within square thumbnail boxes. Native and YouTube video entries retain their native player controls on the main stage. Local rail overflow does not establish a second page-scrolling root. Keep the selected thumbnail visible when selection changes.

## Summary content and live component ownership

The host can supply a responsive, interactive summary snippet. Its inline-size query container travels with its persistent instance. Recommended compositions are one column on narrow panels, two on the wide S detail panel, and up to three within the 3XL pane; these are authoring examples, not viewport queries imposed on arbitrary content.

The equal-width guarantee applies to **M–2XL detail versus carousel**, not to natural height. Detail aligns the summary at the top of the hero; carousel centers it within the fit height. XS/S carousel exposes only title and optional eyebrow. 3XL detail integrates content into the pane and has a different width from the 480px carousel summary.

An actual height is available only after the content is laid out. The resolver returns `width`, an anchor/alignment and an optional maximum height. A caller may provide a previously known **source** height for an early transition; it must not pretend that a free destination snippet has a predictable exact height.

For a staged transition, keep the source component, content, height and query width throughout motion. A persistent presentation host outside the changing Svelte route owns the instance and its effects. A route contributes a slot/claim, not component lifetime. Reparenting a DOM node, retaining a snippet closure from a destroyed route or retaining only a GPU lease does not provide that lifetime. Release the old ownership exactly once and reject stale releases after a newer claim.

Apply the final query width, additional content and natural height in the content phase. Avoid per-frame container-query reflow and non-uniform text scaling. Existing source measurements and later intrinsic-content measurements remain valid; destination DOM measurement must not gate the first forward movement. This ownership and reflow behavior is an integration gate before a broad public snippet guarantee.

## Dock and submenu

The scroll header uses the first 3D view, title, optional eyebrow and a CTA icon. Arbitrary full summary content is not embedded into this compact header. Full titles remain available to accessibility APIs when visual text is ellipsized. The CTA is an actual action, not a second active clone of an input from the summary.

| Layout | Dock height | Minimap fit width / left | Submenu height | Submenu left / maximum width | Initial submenu top |
| --- | --- | --- | --- | --- | --- |
| XS, S | 76 | `80 / 8` | none | none | none |
| M | 80 | `80 / 8` | 40 | `8 / W-16` | `Y+F+8` |
| L | 86 | `80 / 8` | 44 | `8 / W-32` | `Y+F+8` |
| XL | 86 | `112 / 12` | 44 | `L / C` | `Y+F+12` |
| 2XL | 86 | `T / R` | 44 | `L / C` | `Y+F+12` |
| 3XL | Pane header, 86 | No extra dock minimap; rail remains visible | 44 | Centered below pane, maximum `paneWidth` | `H-60` |

The 76px small dock is explicitly dimensioned. The M 80px and large 86px dock/3XL-header sizes are **engineering extractions from the drawn boxes**, made explicit here because the source does not label every dock. The L submenu maximum aligns its right edge with the `W-24` summary edge in the drawing. Its left edge remains 8px. These extracted tokens require the planned visual acceptance checks; they are not content-dependent measurements.

The dock surface spans the available viewport width at top 0 in XS–L. In XL/2XL its surface spans `[R,W-R]` and remains at top 0; it does not inherit the normal menu's 16px gap. Minimap fit geometry is centered vertically against the dock and may overhang its short surface; this is not additional document height. Dock title content starts after the minimap plus the hero's rail-to-stage gap. Reserve the right action region before ellipsizing the title.

**Engineering normalization for compact content:** use one-line 18/24px title typography in XS/S and 24/32px in M+, plus a one-line 14/20px eyebrow when present. Keep the fixed dock heights when eyebrow is absent and center the title block. Extra host actions must fit their declared slot; long/free summary snippets belong in the summary. Tests must include title translations and text zoom.

The submenu starts with the supplied overview icon, followed by the section navigation titles. Width is `min(intrinsicMenuWidth,maxWidth)`; it grows to the right in M–2XL and scrolls horizontally if necessary. It does not stretch short contents to its maximum. M–2XL move with document content until they touch the dock's lower edge:

```text
submenuViewportY = max(dockBottom, submenuDocumentY - scrollY)
```

This clamp applies once the detail dock is active; before that the normal document position remains authoritative. The existing scroll/docking controller owns the reveal interval. The pure resolver exposes both endpoint boxes and the docking threshold rather than inventing an exact scroll position for an intrinsically tall XS/S summary. Leave 8px after the submenu in M/L and 12px in XL/2XL before the following content region.

Submenu, dock and anchor navigation share the same obstruction insets. Focused content and anchor targets must not be hidden beneath them. The submenu uses a DOM surface once docked. In 3XL it is always fixed below the pane and always uses DOM.

## Fullscreen/zoomed 3D

The full viewport is the 3D interaction/rendering area; the green fit box applies to the fitted detail state. Hide the ordinary menu, rail entries other than the minimap and page content during fullscreen. Preserve selection, document position and the actual summary instance while its presentation moves away. The 3XL pane moves away as a unit. Hidden content is not keyboard-focusable or exposed as a second active view.

| Layout | Minimap square | Minimap position | Controls outer inset |
| --- | --- | --- | --- |
| XS, S | 112 | Left 8; bottom 8 | 8 |
| M | 168 | Left/top 8 | 8 |
| L | 178 | Left/top 8 | 8 |
| XL | 220 | Left/top 12 | 12 |
| 2XL | 242 | Left/top 16 | 16 |
| 3XL | 242 | Left/top 28 | 28 |

The help button is 40×40, followed by an 8px gap and an 80×40 two-button view selector. Normal mode aligns that 128×40 group to the green box's upper-right corner; fullscreen aligns it to the table's top/right inset. Controls are present only for 3D. Icons are 24×24 except the 12×12 rail 3D indicator. The minimap always represents the first 3D view and shows the current camera viewport in zoom mode.

Minimap overflow is clipped to its surface; stage geometry itself may leave the fitted rectangle during user zoom. The stage owns camera state and projection, MediaRail owns selection/minimap UI, and the layout resolver owns their boxes.

## 3XL detail: fixed regions over one document

The viewport is divided around its midpoint with a 16px gap between the fitted stage and content pane. The pane is not another vertical scroll root.

```text
paneLeft       = W / 2 + 8
paneWidth      = min(max(0, W / 2 - 28), 1536)
paneTop        = 96
paneBottom     = H - 38
paneHeaderH    = 86
bodyTop        = paneTop + paneHeaderH             // 182
bodyBottom     = paneBottom
bodyViewportH  = max(0, H - 220)
focusBottom    = H - 60                           // clear the overlapping submenu
submenuTop    = H - 60
submenuH      = 44                                // ends at H - 16

railLeft       = 28
railTop        = 96
railWidth      = 138
railMaxHeight  = max(0, H - 112)
railItemGap    = 24
stageLeft      = 178                              // 28 + 138 + 12
stageTop       = 96
stageRight     = W / 2 - 8
stageBottom    = H - 16
```

At `W=2300`, `paneWidth=1122`, so the pane uses grid M. At `W=2456`, `paneWidth=1200` and it switches to grid L. At `W=3128`, it reaches 1536; beyond this width its left edge stays at `W/2+8` and unused right space grows. Before the cap the resulting right inset is **20px**. The original drawing's 28px right-edge annotation conflicts with the author's later midpoint rule plus corrected width table. The formulas above resolve that conflict; there is no alternative 28px-right-edge resolver mode.

| Region | Formula / layout | Overflow and scroll | Owner |
| --- | --- | --- | --- |
| Main menu and satellites | Shell table, fixed initial coordinates | Host menu/popovers; no document translation | Persistent shell |
| Media rail | Fixed rectangle above | Local vertical rail scrolling | MediaRail |
| Main media | Fixed stage rectangle above; canvas still full viewport | Contain image/video; 3D interaction in free left area | Stage/native media |
| Pane surface | `(paneLeft,96,paneWidth,max(0,H-134))` | Clips the body presentation; panel theme background | Detail pane shell |
| Pane header | Pane width, fixed top 96, height 86 | Breadcrumb horizontal overflow; title one-line ellipsis | Detail pane header |
| Summary | Width `paneWidth`, natural height, first body content | Document flow; no local summary height cap | Persistent summary host |
| Sections | Pane's content grid; below summary | Document scrolling; no local vertical pane scroller | Section/document owner |
| Submenu | Natural width capped to `paneWidth`, centered horizontally; top `H-60`, height 44 | Local horizontal overflow only | Detail submenu |

The pane header contains breadcrumb then title followed by optional eyebrow, with a subtle divider and shadow. The 44px submenu overlaps the surface by 22px; anchor and keyboard-focus bounds retain the full 60px bottom clearance. It shows the CTA icon once the summary's CTA region has scrolled out of view; it does not displace the fixed header box. The surface uses the panel background, so transparent sections first reveal this surface rather than directly revealing the scene. Sections inside it do not acquire freestanding section corner radii.

For a body content height `B`, the document must provide at least `max(0,B+242-H)` of useful scroll travel. A simple normalized mapping is `bodyViewportY = bodyTop + bodyDocumentOffset - scrollY`, with the body clipped to `[bodyTop,bodyBottom]`. Any native/sticky or document-proxy implementation must retain this mapping for anchors, scrollspy, browser find, history, keyboard scrolling and focused elements. Do not multiply or apply document scroll twice. The shell, stage and header remain fixed.

**Engineering short-height fallback:** require at least the large stage's 400px fit height inside the fixed composition (`H >= 512`, from `96+400+16`). Below that usable height, use normal document-flow composition with the 2XL hero constraints rather than trapping the page in an unusably small fixed body viewport. This is a height fallback, not a new viewport-width breakpoint. Control dimensions remain unchanged. The renderer must return finite non-negative boxes even for degenerate inputs.

Gesture ownership is decided at pointer-down/wheel target, then retained through that gesture. In the normal 3D split view, the left free area controls the geometry and the right area scrolls the document. UI controls, rail scrolling and player controls take precedence. When an image or video is selected, left free space also scrolls the document. With the pane hidden, all free space is available to 3D. Cross-origin YouTube controls own their internal events; no parent-level gesture handler may promise to intercept all iframe input.

## Carousel composition

A carousel remains an ordinary section: normal content width, grid padding on all four sides, optional section headline and the shared section backgrounds. Its selection/drag behavior and forward placement of the selected element remain intact. Only the deterministic selected-media fit target and summary placement change. There is no media rail or detail view selector.

Let `S` be the section's document top. `A` is `headlineLineHeight + headlineGap` when a headline exists and 0 otherwise. `K = S+p+A` is the start of carousel content. The normal content grid supplies `p`, `g`, `colX` and `span`.

| Layout | Selected fit left | Fit width | Summary placement / width | Fit height min / max |
| --- | --- | --- | --- | --- |
| XS | `L+p+36` | `C-2p-72` | Same x/width, above fit | 150 / 300 |
| S | `L+p+72` | `C-2p-144` | Same x/width, above fit | 150 / 400 |
| M | `colX(2)` | `span(3)` | `colX(5)`, `span(3)` | 300 / 500 |
| L | `colX(3)` | `span(5)` | `colX(8)`, `span(4)` | 340 / 600 |
| XL | `colX(2)` | `span(5)` | `colX(7)`, `span(4)` | 400 / 700 |
| 2XL, 3XL | `colX(2)` | `span(6) = 732` | `colX(8)`, `span(4) = 480` | 400 / 800 |

These spans use the textual dimension labels and grid columns. The rendered example geometry is illustrative and is not a replacement for the labelled fit target. In particular, the large carousel label 5 columns must not become a second, screenshot-measured media width. 3XL follows 2XL, including its 480px summary; the older 496px label is superseded.

XS/S reserve a 66px title strip above the fit target. With an eyebrow the compact panel occupies all 66px; without one it occupies 40px and is bottom-aligned in the same strip. Therefore selected geometry does not jump when selection changes to an item without an eyebrow. Source variants show inconsistent extra spacers and a single S 80px horizontal label; **engineering normalization** uses the same 66px strip and the repeated 72px S side allowance in every variant. The compact panel is framework-owned title/eyebrow/navigation UI, not an unrestricted full summary snippet.

For M+, the fit starts at `K`. The summary has a natural height capped at the fit height and is vertically centered: `summaryY = K + (fitHeight-renderedSummaryHeight)/2`. It may scroll locally when taller than its cap. Preserve the same full summary width as the corresponding detail layout.

The dots strip is 32px high, placed immediately after the media fit in XS/S, after a 12px gap in M, and after a 16px gap in L+. Its contents stay centered in the normal section container and may scroll horizontally when required. Keep dots, arrows and the summary in their layout positions during sensor camera motion. The existing scene behavior owns the depth/perspective of non-selected objects; their exact projected boxes are not layout constraints. Pointer proximity rotates individual elements as already accepted; it must not restore the rejected whole-scene mouse parallax.

### Carousel height resolution

The source's height-subtraction labels conflict with some dimensioned paddings and with the later 24px/16px correction. Use a single additive budget as an **engineering normalization**, so removing a headline cannot accidentally change unrelated gaps. Reserve the drawing's 28px next-content preview in this budget; this reserve is not an actual extra spacer in the document.

```text
shellBudget = 90 (XS/S), 96 (M), 106 (L), 120 (XL+)
titleStrip  = 66 (XS/S), 0 (M+)
dotsGap     = 0 (XS/S), 12 (M), 16 (L+)
offset      = shellBudget + 2p + A + titleStrip + dotsGap + 32 + 28
fitHeight   = clamp(layoutMinimum, H - offset, layoutMaximum)

fitTop      = S + p + A + titleStrip
dotsTop     = fitTop + fitHeight + dotsGap
sectionEnd  = dotsTop + 32 + p
```

The shell budget is a stable sizing input, not a measurement of how far this particular section has been scrolled. Other sections above the carousel do not shrink the fit target. In a very short window the minimum may make the section taller than the viewport; document scrolling remains available. Width and height can never become negative.

| Layout | Canonical offset with headline / without | Original annotation with / without | Resolution |
| --- | --- | --- | --- |
| XS | 276 / 240 | 276 / 240 | Matches additive budget |
| S | 284 / 248 | 280 / 244 | Correct bottom section padding from 12 to grid S's 16 |
| M | 244 / 200 | 244 / 200 | Matches additive budget |
| L | 286 / 230 | 260 / 208 | Use grid padding and one consistent 16px dots gap |
| XL | 300 / 244 | 300 / 222 | Missing headline removes exactly 40+16 |
| 2XL, 3XL | 300 / 244 | 247 / 222 in 2XL | Apply corrected large-grid 24px padding and 16px headline gap, consistently with XL |

These normalized offsets are explicit implementation decisions, not newly attributed author values. Visual acceptance should compare the resulting geometry/rhythm to the references and confirm that large minimum heights remain usable. Do not keep original and normalized offsets as independently selectable runtime modes.

## Media, input and surface responsibilities

Selecting image/video hides the 3D scene background and presents the selected medium within its fit target. Returning to a detail route starts with its first 3D medium; media selection is transient and is not stored as a history destination. Embedded-player loading and intrinsic image sizes do not alter the declared fit rectangle. Supply aspect-ratio placeholders while media load.

All existing sensor-axis direction, limits, scroll pause, touch-release recalibration and gradual resumption remain part of interaction behavior. The layout change does not increase sensor intensity or make evaluation run during an active horizontal/vertical scroll gesture. Canvas motion must not move layout controls, dock text or the summary surface.

| Surface | Detail XS–2XL, glass theme | Detail 3XL, glass theme | Ordinary ContentPage |
| --- | --- | --- | --- |
| Menu / satellites | GPU only over the guaranteed canvas context | GPU | DOM |
| Rail / stage controls | GPU | GPU | Not applicable |
| Scroll dock | DOM | Pane header DOM | Not applicable |
| Submenu | GPU undocked; DOM docked | DOM | Not applicable |
| Summary | GPU | Integrated DOM pane | Carousel context chooses a declared surface |
| Content pane | Not applicable | DOM | Not applicable |

The GPU glass effect samples the canvas background; it does not refract arbitrary underlying HTML. Determine the surface context from the page/layout contract, not a per-frame DOM overlap scan. The content instance stays live during surface changes. Native/no-JavaScript and unsupported-GPU fallbacks use semantic DOM with the same layout, focus order and scroll ownership. The two theme radius roles follow the [content contract](content-layout.md).

## Resolver outputs and validation boundary

Core returns the selected viewport/grid classes, content containers, shell/breadcrumb reservations, hero/media-fit rectangles, rail constraints, summary width/anchor/height policy, dock endpoints, submenu maximum/anchor, fullscreen minimap/controls, and 3XL pane/body viewport mapping. It accepts viewport state, safe insets, page mode, media mode, headline presence and known source geometry; it never needs destination DOM or GPU access.

The DOM adapter supplies natural content heights and intrinsic menu widths when needed for final flow and centering. It owns semantic order, native scrolling and focus. The stage consumes declared rectangles and existing camera/resource state. The transition coordinator owns phases and leases; it must distinguish a known rectangle from an anchor with an unknown natural height.

Required checks include all breakpoint neighbors, the 1536px content cap, pane widths at 2300/2456/3128, short heights, safe areas, long snippets, title/eyebrow variants, local rail/summary overflow, 3XL document anchors and media input, fullscreen return, live snippet state across route commit, browser-toolbar stability and SSR/no-JavaScript layout. See [validation.md](validation.md) for the shared acceptance fixtures.
