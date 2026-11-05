# Detail and catalog feedback corrections

These changes address the first device review of the shared layout system. They
apply to ordinary navigation as well as the opt-in staged path. Staged navigation
and the experimental Background output keep their existing opt-in gates.

## Navigation and live content

Optional eyebrows and rich summary content are not geometry prerequisites. A
compact carousel or S card may omit them or hide them through CSS. Partially
clipped detail content likewise cannot prevent the visible geometry from
returning to its catalog occurrence. Only fully presented text participates;
required geometry, title and surface checks remain in place.

Transition resize cancellation uses the stable viewport probe already used by
layout. Android browser chrome can change the visible height without changing
the endpoint layout. Width, stable height and device-pixel-ratio changes still
cancel incompatible motion.

The ordinary route now retains and adopts the actual Svelte summary instance,
including bindings, before the destination is measured. A temporary hidden owner
spans route teardown. This semantic transfer also runs when decorative GPU motion
is declined or reduced. The staged owner remains separate. Deferred summary
mounting also preserves context updates made before the root exists, including
the initial desktop-to-mobile layout correction.

The default summary owns its 24px body line height. Inheriting typography from
the surrounding Section changed its height when the same nodes moved into the
detail render layer. Heading and action typography keep their own explicit rules.

An optional section shortcut is outside the shared panel surface. The brand
examples omit the redundant Explore Features shortcut. The detail link uses the
diagonal up-right arrow from the layout design.

## Detail geometry and input

The hero fit rectangle is a hard resting containment boundary, including model
depth. Authored magnification may consume padding but cannot overlap the media
rail or summary. The mounted and prepared destination cameras use the same fit.

The docked model aligns its projected upper edge with the safe viewport top.
Alignment is recomputed during hover, sensor motion and panel tilt, and blends
into the existing scroll morph. Prepared transitions use the same mesh corners.
If enlargement crosses the safe left viewport edge, a minimal camera-right
translation keeps the whole model visible without changing its upper edge or scale.

The media rail confines horizontal scroll only. Vertical swipes on the rail and
summary can chain to the document. XL/2XL breadcrumbs align with the centered
content width. The view toggle uses the authored box-detail/fullscreen SVG paths.

## 3XL pane zoom

The native pane reads the same damped UI focus as ordinary panels. Its surface,
header, body and submenu share fade, blur and perspective motion; the integrated
summary does not animate twice. Paint transforms are inverted when measuring
document anchors and never change document height. Hidden controls become inert,
and returning restores the saved reading position and live input nodes. Blur is
only installed while zooming, so it does not create a resting filter layer.

## Regression entry points

- `playwright.layout-feedback.config.ts`: actual forward/reverse animation at
  430/2456 px, live summary identity/bindings/focus, touch scrolling, breadcrumbs,
  icons and the document-scrolling pane (native, no-JavaScript and WebGPU).
- Brand Examples `playwright.geometry-bounds.config.ts`: actual Multigate3 fit at
  XL/2XL and FKP003/ASV101 dock/animated-hover bounds at 430/1880 px.
- Brand Examples `playwright.layout-feedback.config.ts`: panel parity, controls,
  touch/wheel input, history, immediate Back and top-to-top header continuity.

The touch checks emulate Chromium input. They do not replace a physical Android
device check, particularly for system Back and address-bar animation.

## Verification of the corrections

The framework changes are recorded in `08338e8`, `ea652ac`, `aabbb3a` and
`f0979e0`; the coordinated Brand Examples change is `cff1694`. Validation uses
production builds with one GPU browser worker:

| Check | Result | Local evidence |
| --- | --- | --- |
| Core, Svelte adapter and demo production builds | Passed | `.artifacts/layout-feedback-edge-package-build.log`, `.artifacts/layout-feedback-edge-demo-build.log` |
| Framework and demo type checks | 0 errors, 0 warnings | `.artifacts/layout-feedback-edge-typecheck.log` |
| Full unit suite after the final geometry correction | 1,144 passed in 132 files | `.artifacts/layout-feedback-edge-units.log` |
| Framework navigation, live bindings, detail input and 3XL pane | 19 passed | `.artifacts/layout-feedback-final-browser.log` |
| Prepared scroll-header transitions after the final geometry correction | 6 passed at 430, 1440 and 2456px | `.artifacts/layout-feedback-edge-dock.log` |
| Brand Examples production build and type check using the final local packages | Passed; 0 type errors or warnings | Examples `.artifacts/layout-feedback-edge-build.log`, `.artifacts/layout-feedback-edge-check.log` |
| Brand Examples final panel parity, touch/wheel input and Wurm model bounds | 11 passed | Examples `.artifacts/layout-feedback-edge-browser.log` |
| Additional Examples controls, history, immediate Back and header continuity | 9 passed in the earlier combined run | Examples `.artifacts/layout-feedback-browser.log` |

The 19-case browser run precedes the final safe-left alignment and default-summary
line-height follow-up. The six scroll-header cases and focused brand-example
checks cover those final changes separately. Generated layout CSS and dependency
boundaries also pass. This is functional regression evidence; it does not close
the separate physical-device or navigation-performance acceptance gates.

The first combined Examples run passed 15 of 20 cases. Its five failures identified
the inherited summary line height and an insufficiently scrollable gesture-test
fixture. The final 11-case run covers those five plus all six model-bound cases;
the other nine scenarios passed in the earlier run. Screenshot and JSON evidence
for the final geometry cases is in Examples
`.artifacts/layout-feedback-edge-regression`. The final local package files were
hash-checked against the framework build; manifests and lockfiles remain unchanged.
