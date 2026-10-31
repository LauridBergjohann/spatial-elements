# Detail docking and section navigation

This implements the XS–2XL dock contract in [detail-layout.md](detail-layout.md). The fixed 3XL pane is a separate composition: it keeps its rail visible and owns its pane header and bottom submenu. A short 3XL viewport uses the normal 2XL fallback defined by the shared resolver.

## One set of geometry rules

`resolveSpatialElementDockLayout()` derives the header, minimap fit square, submenu maximum and section obstruction offset from `resolveDetailLayout()`. It does not select another compact breakpoint or measure an invisible destination header. The only input measured from content is the submenu's intrinsic width. Short menus retain that width; long menus are bounded and scroll horizontally.

| Layout | Header | Minimap fit | Submenu |
| --- | --- | --- | --- |
| XS/S | 76px | 80px | absent |
| M | 80px | 80px | 40px |
| L | 86px | 80px | 44px |
| XL | 86px | 112px | 44px |
| 2XL | 86px | up to 138px, constrained by the outer band | 44px |

The minimap fit square is vertically centered on the header. It may overhang its short surface; the header height remains fixed. The normal model scale is one, with explicitly authored dock-view scales retained. The controller does not additionally align the actual projected model's top to the header edge: non-square models keep their natural fit centering instead of jumping vertically at docking. The lower 2XL boundary needs a documented normalization: `T = min(0.07W,138,max(0,L-24-8))`, then `R=L-24-T`. At 1809px this gives a 104.5px thumbnail with an 8px outer inset, preserving the content anchor and the 24px rail-to-stage gap.

The header uses a single-line 18/24px title in XS/S and 24/32px in M+, with an optional 14/20px eyebrow. Visual ellipsis does not remove the complete accessible text. Empty eyebrows leave no blank row. The compact CTA appears after the summary action passes above the dock; the hidden source action then becomes inert. It is restored when scrolling back.

## The submenu keeps its actual DOM

There is one `SpatialElementTabList`. Its first link uses the supplied overview icon with the original accessible label; later links come from the Section registry. The source panel is the Svelte owner for the entire route lifetime.

Before docking, the list is inside its normal spatial panel. At the common boundary, the controller moves that same node into a viewport overlay with a DOM glass surface and hides the source surface. Moving it back restores its original DOM position. The list, links, event handlers and component effects are retained. No second navigation is rendered, and no cloned interactive controls become active.

Where available, `Element.moveBefore()` preserves browser-managed state during the move. The fallback records the focused node and horizontal scroll position and restores both without scrolling the document. This is in-route persistence; it does not claim to solve route-lifetime ownership of arbitrary summary snippets.

The split composition supplies an empty `[data-spatial-detail-pane-submenu]` host. The controller transfers the same list to it and publishes its intrinsic width as `--spatial-detail-submenu-natural-width`; the pane owns centering, bounds and its DOM surface. Only after transfer does `[data-spatial-detail-pane-tabs]` hide the old source anchor. Without JavaScript, the source anchor itself provides the CSS-positioned pane submenu. Returning to a flow layout restores that same list before measuring its document anchor.

The measured source width and canonical dock width must match. The detail page places the native source at `x=8` in M/L and at the normal content-container edge in XL/2XL. Docking occurs when the source top reaches the header bottom. A short radius morph changes only the surface; it does not resize the navigation or shift text. The DOM backdrop extends one pixel across the surface seam without changing endpoint coordinates.

## Scroll and anchor ownership

The document remains the scroll owner. Under enhanced scrolling, only the minimap inside the translated document receives the visual-scroll compensation; the detached header and submenu already use viewport coordinates. Under native scrolling that compensation is zero. Applying it in both modes would move the supposedly fixed minimap downward while the page scrolls.

The shared obstruction is header bottom plus the available submenu height and the layout's reading gap. The controller publishes it as `--spatial-element-section-scroll-offset`; Sections and the existing scrollspy use the same value. XS/S reserve only their header and reading gap because there is no submenu. In split composition the flow override is removed and the pane supplies its body-top obstruction. Existing hash links and section identifiers remain native links.

The source panel reserves its full height while its list is in the overlay. Content therefore does not shift during the surface change. Font completion, content changes and resize trigger an intrinsic-width update; regular scroll frames use cached geometry. Sensor evaluation, camera poses and the navigation transition machinery remain owned by their existing controllers.

## Verification

The public `/demo/layout-docking` fixture includes long translated labels, an overflowing submenu, a long title/eyebrow, an action and eight document sections with focusable controls. `tests/detail-docking.e2e.ts` covers SSR without JavaScript, all flow-layout header sizes, native and WebGPU DOM identity/focus, direct hashes and keyboard navigation to a far section. Core tests cover safe-area/scrollbar arithmetic, the 2XL edge normalization and native versus virtual minimap compensation.

The 3XL pane's fixed submenu, pane-header action and split-layout anchor mapping are validated with the dedicated 3XL integration rather than inferred from the flow-layout tests.
