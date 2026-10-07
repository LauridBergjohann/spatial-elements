# Interface texts and interaction help

Spatial Elements supplies English interface copy. The host application owns the locale, translations and language switching. Pass a `messages` object to the persistent `BrandStageShell`; no translation library or automatic browser-language detection is required.

~~~svelte
<script lang="ts">
  import { BrandStageShell, type SpatialMessagesInput } from '@spatial-elements/sveltekit';
  import { theme } from '$lib/theme';

  let { children } = $props();
  const messages = {
    controls: {
      help: '3D-Steuerung',
      closeHelp: 'Hilfe schließen',
      detailView: 'Detailansicht',
      fullscreen: 'Vollbild'
    },
    interactionHelp: {
      title: 'In 3D erkunden',
      rotate: 'Drehen',
      zoom: 'Zoomen',
      pan: 'Verschieben',
      mouseRotate: 'Mit gedrückter linker Maustaste ziehen',
      mouseZoom: 'Mausrad bewegen',
      mousePan: 'Mit gedrückter rechter Maustaste ziehen',
      mouseNavigationHint: 'Nutzen Sie alternativ eine {spacemouse} zur Navigation.',
      touchRotate: 'Mit einem Finger ziehen',
      touchZoom: 'Zwei Finger auseinander- oder zusammenziehen',
      touchPan: 'Zwei Finger gemeinsam bewegen',
      touchHint: '3D · Mit einem Finger drehen',
      touchScrollHint: 'Außerhalb des Modells berühren, um die Seite zu scrollen.'
    }
  } satisfies SpatialMessagesInput;
</script>

<BrandStageShell {theme} {messages}>
  {@render children?.()}
</BrandStageShell>
~~~

All groups and individual keys are optional. Omitted or `undefined` values fall back to their English defaults, including when only one key in a group is translated. Supply plain text, not HTML. Translate whole phrases so their order is not constrained by the component. Empty strings are preserved; do not use them for accessible labels.

Updating `messages` updates the visible help, icon-button accessible names and tooltips without remounting the shell or resetting the user's learning state. For example, pass `messages={translations[locale]}` with a reactive `locale`, or derive the object from your existing i18n system. Product titles, feature descriptions and other authored content continue to come from application data.

Both packages export `SpatialMessages`, `SpatialMessagesInput`, `defaultSpatialMessages` and `resolveSpatialMessages`. Use the input type for translation dictionaries: unlike the resolved type, it does not require your application to immediately supply newly added keys. `resolveSpatialMessages(input)` returns an independent, complete dictionary. Defaults are immutable.

## Available strings

| Key | English default / use |
| --- | --- |
| `controls.help` | `3D controls` — icon-button accessible name and tooltip |
| `controls.closeHelp` | `Close help` — close-button accessible name and tooltip |
| `controls.detailView` | `Detail view` — detail-mode button accessible name and tooltip |
| `controls.fullscreen` | `Fullscreen` — fullscreen-mode button accessible name and tooltip |
| `interactionHelp.title` | `Explore in 3D` |
| `interactionHelp.rotate` | `Rotate` |
| `interactionHelp.zoom` | `Zoom` |
| `interactionHelp.pan` | `Pan` |
| `interactionHelp.mouseRotate` | `Drag with the left mouse button` |
| `interactionHelp.mouseZoom` | `Use the scroll wheel` |
| `interactionHelp.mousePan` | `Drag with the right mouse button` |
| `interactionHelp.mouseNavigationHint` | `Alternatively, use a {spacemouse} to navigate.` |
| `interactionHelp.touchRotate` | `Drag with one finger` |
| `interactionHelp.touchZoom` | `Pinch with two fingers` |
| `interactionHelp.touchPan` | `Drag with two fingers` |
| `interactionHelp.touchHint` | `3D · Drag with one finger to rotate` |
| `interactionHelp.touchScrollHint` | `Touch outside the model to scroll the page.` |

Use `controls` for control labels/tooltips and `interactionHelp` for the instructional content. Future package controls can add keys to this same configuration, with English fallbacks. There are currently no AR controls or corresponding message keys.

The help displays compact mouse or touch diagrams beside the short `rotate`, `zoom` and `pan` labels. Mouse buttons, the wheel and touch-motion arrows use `theme.colors.accent`. The longer `mouse*` / `touch*` instructions remain in the accessible definition list for screen readers, without taking up visible space. Translate these descriptions as well as the short labels. Touch help also displays `touchScrollHint` below the diagrams.

Mouse help displays `mouseNavigationHint` below the same separator. Its `{spacemouse}` placeholder inserts a link labelled **SpaceMouse** to `https://3dconnexion.com/`, opening in a new tab. Keep or reposition the placeholder anywhere in your translated sentence; the rest is escaped plain text. Omitting the placeholder displays your text without a link. No translated HTML or configurable URL is needed. The touch scroll hint remains unchanged.

## Detail-page view switch

Enhanced detail pages start in **Detail view**. A two-button group switches between the page and **Fullscreen**; the help button sits 8px to its left. The group shares the help button's panel material and icon color, uses the configured panel radius on its outside corners, and highlights the selected button with the section navigation's 8% body-color fill, without an underline or additional theme setting. A page-layout icon represents the detail view, and an expand icon represents fullscreen. Both buttons expose their selection through `aria-pressed`.

Fullscreen uses the browser Fullscreen API. If it is missing, disabled or rejects the request, the same view fills the browser viewport. Only the model/background, expanded minimap, help and view switch remain visible. Dragging, pinching, panning and wheel zoom work across the canvas, including empty background; geometry picking, hover glow and the introductory pointer preview are disabled. SpaceMouse continues to use the same camera. The minimap stays in the close-up size and corner position, follows the live model orientation and shows the camera's visible region. Its ordinary hover and reset behavior remain available. On narrow phones, the control row moves just below the expanded minimap to keep both usable without shrinking the minimap.

Select **Detail view** to return. Browser fullscreen exit and Escape also synchronize the switch; the fallback supports Escape directly. Scroll styles and the previous page position are restored on exit or navigation. The touch-only page-scroll hint is hidden while fullscreen is active. These controls require the enhanced 3D renderer; missing fullscreen support alone never hides the switch.

## Detail-page interaction help

Enhanced detail pages include a 40 × 40 CSS-pixel help button and an 80 × 40 view switch at the upper right of the model area, next to the summary panel on desktop. The switch's gap to the summary is 12px smaller than its gap below the header (at least 16px). During close-up the controls and summary's projected top-left corner move together, keeping their gap as the panel grows and fades out past the upper-right viewport edge. The switch reaches its final 10px top/right inset inside the usable viewport, excluding the scrollbar, exactly when the panels become transparent; help stays 8px to its left. The minimap starts expanding slightly later but also reaches its final position and size at that same endpoint. No peripheral movement continues after clearance. All poses read the same damped camera position and reverse with zoom, without a separate animation or delay. On stacked layouts the controls travel directly from the model column to the corner while the summary below follows its ordinary exit path. They use the theme's panel surface, tint, blur, shadow and ink color. Mouse hover uses the same 8% body-color highlight as the section submenu, without movement or tilt. The help button's accessible name and native tooltip come from `controls.help`; the button contains no visible text.

The non-modal help opens next to this button, stays within the viewport and adapts the gesture descriptions to actual mouse/touch input. Its surface uses the same panel renderer, including WebGPU refraction in the `glass` theme. Clicking the button opens persistent help. Keyboard activation focuses its close button; Escape or the close button restores focus when appropriate. Automatically displayed help does not move keyboard focus. The user can move the pointer into the help or focus its controls and read without a time limit.

Before the first model interaction, sustained mouse hover on model geometry opens the help after 600ms. Leaving the geometry, help and button hides automatic help after 350ms; returning to the geometry can show it again. Moving back during this delay keeps it open. Manually opened help stays open when the pointer leaves. A real model drag, wheel zoom or SpaceMouse interaction suppresses all subsequent automatic help for the tab session, even if performed before the first hover delay. Touch devices initially show a short, non-interactive hint; dragging the model works on the first contact, without dismissing anything first. The hint disappears after model interaction. The icon button can still reopen the help.

Learning state is shared across products and brands in the same application/origin and is retained in `sessionStorage` under `spatial-elements:interaction-guidance:v1`. It survives page reloads in the same tab and resets with a new tab session. If storage is unavailable, an in-memory state lasts until the document is replaced. No cookies, tracking or network requests are involved. To inspect the first-use behavior again during development, clear this key and reload, or start a fresh browser context.

Before the first manual interaction, nearby mouse movement can gently orbit the model by up to 2.5° on each axis. The motion settles to rest; it does not continuously animate. Starting a drag takes over the currently visible pose without a jump. Manual model interaction disables this preview for the session. Reduced-motion preferences disable the introductory motion and the button's color transition. Touch uses direct manipulation; no orientation sensor permission or idle animation is required.

## Related panel options

`Panel` accepts `pointerReactive={true}` for proximity lift and tilt, `"lift"` for a 2px mouse-only lift, or `false` for no motion. The approach band outside a panel is bounded to 12–32px. `focusReactive={false}` keeps a panel available when model close-up fades the surrounding UI; `focusReactive="top-right"` also moves it to the viewport corner. An optional `focusAnchor` panel frame couples that neighbour's projected top-left edge to the control's exit path. Both finish with the panel fade, preserving their authored spacing. Defaults remain `true` for both reactive options. The built-in help button uses `pointerReactive={false}`, `focusReactive="top-right"` and the summary frame as its anchor.

For native overlays, `nativeContent` retains the panel's content in its DOM owner (for example, a `popover`) while rendering its glass surface through the stage. Combine it with `pointerReactive={false}`, `focusReactive={false}` and `visible={open}`. Native layout determines its size. For an overlay anchored to moving stage content, supply `nativeLayout={() => positionOverlay()}`: the stage calls it after committing the anchor DOM positions, then measures and draws the overlay surface in that same frame. The callback should only update layout, without dispatching another layout event. For external changes, signal `STAGE_PANEL_LAYOUT_EVENT` to request a frame. Visibility changes and resize observation update its surface automatically. The built-in help uses this internally; hosts do not need to construct either control.
