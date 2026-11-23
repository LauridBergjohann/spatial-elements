# Persistent navigation shell

Implementation note for step 07. The canonical measurements remain in `layoutTokens.json` and
[detail-layout.md](detail-layout.md); the shell does not maintain another breakpoint table.

`BrandStageShell` accepts optional `menu`, `left` and `right` snippets. It owns their persistent
Panel components, bounds and surface material. The application supplies links, labels, branding
and actions. The menu is 66px high at XS–L and 64px high with 16px top spacing from XL. Satellite
regions appear from XL, each 80×40px at the specified outer inset. Omitted snippets do not create
empty interactive panels. Without any shell snippets, existing custom shell composition still works.

```svelte
<BrandStageShell {theme}>
  {#snippet menu()}<MainNavigation />{/snippet}
  {#snippet right()}<SettingsTrigger />{/snippet}
  {#snippet footer()}<SiteFooter />{/snippet}
  {@render children()}
</BrandStageShell>
```

The optional `footer` snippet follows the stage in normal document flow. Use the Page Sections
`Footer` there for shared branding, navigation and legal links. It scrolls above the stationary
stage in every layout, including 3XL. The space before the footer is transparent, retaining the
same scene background as the sections. Only the footer's local translation follows the existing
visual scroll clock; there are no footer boundary measurements, canvas translations or extra
pointer-coordinate corrections. No nested scroll container is introduced.

The split pane applies scroll compensation only to its fixed frames. The per-frame scroll
and focus-origin properties are registered with `inherits: false`, so the browser does not
recalculate every content descendant when these paint values change.
The displacement is disabled in fullscreen and resets when navigating to a content page.

The host must keep content within these boxes and use a menu/popover for overflow. The generated
`spatial-shell-compact-only` class hides an in-menu alternative from XL. It can expose satellite
actions inside smaller menus without dropping functionality. The demo's appearance selector uses
one 40px trigger and a native popover containing Light, Dark and System options. Menu links remain
available through native `details` on narrow screens, including without JavaScript. Theme selection
requires JavaScript, as it did previously.

## One scroll coordinate rule

The native document implements the 32px bound with a sticky rack inside a containing block
extended by 32px. A matching negative bottom margin removes that extra document reservation.
Menu and satellites share the rack, so their different heights cannot cause different thresholds.

The enhanced virtual document already translates all content by `-visualScrollY`. Its rack therefore
adds only `visualScrollY + resolveMenuOffset(visualScrollY, fixed)`. This equals the bounded
compensation normally and the entire scroll distance for fixed detail 3XL. The shell subscribes
immediately after the virtual-document scroll subscriber and before docking/rendering. It uses no
separate scroll animation or direction-sensitive reveal state.

Panel frames identify their shell through `data-stage-scroll-shell`. Before caching document
coordinates, PageBindingController subtracts the rack's already applied compensation. Resolving a
cached rectangle then applies `resolveMenuOffset` once. This is necessary even when measurements
are refreshed mid-gesture. Native fixed popovers keep their separate viewport-coordinate handling.
The fixed-detail flag comes from the same generated responsive CSS that drives the native fallback;
changing it invalidates panel layout without recreating content.

The shell's Panels keep `nativeContent`, so semantic navigation and popovers retain their DOM
owner. Content pages and ordinary detail layouts use DOM frosted surfaces over potentially mixed
DOM/canvas content. Fixed detail 3XL may use the authored panel material because its menu area is
above the content pane. A route change does not key/recreate the shell or mark it as entering page
content. Native open popovers and disclosure menus close on navigation.

Open Page Sections submenus, mobile/settings disclosures, the content menu and custom
absolute-positioned overlays marked with `data-ps-popup` enter the browser top layer.
`data-spatial-navigation-popup` remains supported. Set the attribute only while the custom
popup is open; its component owns toggle, outside-click, Escape and navigation dismissal.
The website search marks the complete input/results surface in compact layouts and only
the results in wide layouts. Burger, settings and compact-search triggers use the accent
and tab-background colors while open. Main-menu labels never wrap; the website uses the
compact search at 1200–1599px to reserve room for the desktop navigation.

BrandStageShell installs a single document-level coordinator, including when no header is
provided. Its compatibility implementation works with Page Sections 0.5.1 and shares
ownership with the corresponding upcoming Page Sections enhancement. The DOM hierarchy,
delegated events and native disclosure state stay intact. Chromium may retain an invisible
layout box after closing a popover inside details; a one-time display reset on reopening
repairs that box without replacing nodes or handlers.

One noninteractive top-layer backdrop blurs the page by 3px while a popup is open. Navigation
and its triggers remain sharp. The layer is removed when the last popup closes, with no
filter animation, permanent compositor hint or additional stage render loop. Popup positions
are captured on opening; scroll and resize dismiss them through their owners instead of
continually measuring layout. Route changes also close owned popups.

Native ownership does not remove the existing close-up exit. The shell surface and its content
follow the same focus offset, perspective scale, fade and text blur as the GPU panel. Only the
surface is transformed; the registered frame and scroll rack remain unchanged, so measuring a
zoomed shell cannot feed its visual offset back into the layout cache. Hidden navigation is inert,
and leaving close-up or releasing the renderer restores its original interaction state. The
native-summary pane and independently positioned help popover do not use this shell-only path.

## Breadcrumb contract

Breadcrumb font size and reserved height come from viewport layout tokens, not content grid
classification. Breadcrumbs remain one line with native horizontal scrolling. The initial scroll
origin reveals the trailing end without JavaScript; the inner list retains its semantic reading
order. Detail 3XL omits only the final current-page label, retaining the preceding separator.

## Evidence and integration checks

- PageBinding unit coverage remeasures at scroll 0/48/112/140/300 and resolves later/earlier
  positions for both bounded and fixed modes. This checks against the native sticky formula.
- `tests/navigation-shell.e2e.ts` covers responsive boxes, native/no-JavaScript and hydrated
  scrolling, narrow-screen navigation, appearance actions and enhanced shell persistence.
- Actual application validation must include restored scroll, changing 2XL/3XL at a fixed
  viewport height, menu focus, and list/carousel-to-detail navigation while both pages are at top.
- Existing host outer padding, header widths and artificial detail minimum heights are removed
  in the demo and brand layouts. Section/card and upcoming detail layout owners determine content
  geometry; hosts no longer add another shell inset.
