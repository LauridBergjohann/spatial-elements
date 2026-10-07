# Runtime themes and ButtonGroup

The host application owns theme preference, system detection, persistence and the switch UI. Spatial Elements accepts a resolved theme and updates its DOM, panels, minimap, hover outline and HDR backdrop without resetting the model, camera, zoom or fullscreen state.

## Define two palettes

Create a complete `SpatialTheme` for each palette, keeping the same `id` and `name`. The ID is a namespace, not a light/dark identifier. Existing `colors`, `panelTheme`, `dockedPanelTheme`, `sectionTheme`, `minimapTheme` and `interactionTheme` settings describe both palettes; there is no separate set of dark-color properties.

```ts
import { createSpatialTheme } from '@spatial-elements/sveltekit';

export const light = createSpatialTheme({ id: 'collection', name: 'Collection' });
export const dark = createSpatialTheme({
  ...light,
  background: '#121923',
  sceneBackground: { tint: '#0e1622', tintIntensity: 0.86 },
  panelTheme: { ...light.panelTheme, tint: '#172434', tintOpacity: 0.82 },
  dockedPanelTheme: { ...light.dockedPanelTheme, tint: '#172434', tintOpacity: 0.94 },
  sectionTheme: { ...light.sectionTheme, tint: '#172434', tintOpacity: 0.9 },
  colors: { ink: '#edf4fc', body: '#c8d6e7', accent: '#80bfff', onAccent: '#102438', tabBackground: '#243548' },
  minimapTheme: { ...light.minimapTheme, viewportColor: '#80bfff' },
  interactionTheme: { ...light.interactionTheme, outlineColor: '#80bfff' }
});
```

`sceneBackground` is optional. Its `blurriness`, `tint` and `tintIntensity` fields override the corresponding element background fields. Removing an override restores the element's settings. It changes the visible HDR backdrop, not HDR lighting, model materials or asset identity. `background` remains the flat page color.

## Supply the resolved theme

```svelte
<script lang="ts">
  import { BrandStageShell, ButtonGroup } from '@spatial-elements/sveltekit';
  import { light, dark } from './themes';
  let { children } = $props();
  let colorScheme = $state<'light' | 'dark'>('light');
  const theme = $derived(colorScheme === 'dark' ? dark : light);
</script>

<BrandStageShell {theme} {colorScheme}>
  <ButtonGroup label="Appearance" shape={theme.panelShape} theme={theme.panelTheme}
    items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
    value={colorScheme} onchange={(value) => { colorScheme = value === 'dark' ? 'dark' : 'light'; }} />
  {@render children()}
</BrandStageShell>
```

`colorScheme` is optional and accepts only `light` or `dark`. It sets the wrapper's CSS `color-scheme`, including native form controls. The library never reads `matchMedia`, writes storage or modifies the document's global preference. A host can use two buttons, three buttons, a menu, or no switch at all. Update the `theme` prop with the chosen palette; do not key/recreate the shell.

The demo and brand examples implement **Light / Dark / System** in their shells. System is the default and responds to operating-system changes. Explicit choices use `sessionStorage`, surviving navigation and reload within that tab. System clears the override. A blocked store falls back gracefully to in-memory behavior. For SSR, their early HTML bootstrap selects the palette before hydration; `getSpatialThemeStyle(theme)` supplies CSS declarations for the temporary preview. Applications with a CSP should authorize their bootstrap using their usual nonce/hash policy.

## Reuse ButtonGroup

`ButtonGroup` is a controlled, theme-independent choice component inside a `Stage` or `BrandStageShell`, with the same panel surface and selected treatment as the detail/fullscreen switch. Place it beside other panels rather than nesting it inside a `Panel`.

| Property | Meaning |
| --- | --- |
| `items` | Readonly array of `{ value, label, tooltip?, disabled?, selection? }`. Values must be unique. |
| `value` | Selected value; omit to leave all buttons unselected. |
| `onchange` | Called with the clicked value, including clicks on the current selection. |
| `label` | Accessible name of the group. |
| `content` | Optional `Snippet<[ButtonGroupItem]>` for icons or custom content. Otherwise displays the label. |
| `iconOnly` | Fixed 40px button width; default false uses intrinsic text width. |
| `shape`, `theme` | Same appearance contract as Panel. Control radius is capped at 12px; content inset is zero. |
| `disabled`, `visible` | Disable the group or temporarily hide its contents. |
| `focusReactive`, `focusAnchor`, `transitionGroup` | Optional integration with stage focus and transitions. |

Each label also provides its default tooltip; the host supplies the language. Buttons expose `aria-pressed`, native keyboard activation and focus outlines. The optional `selection` strength fades the selected background independently of semantic selection, as used by the detail button while zooming. The component does not store state or know about themes or languages.

Custom core integrations can call `StageExperience.updateAppearance({ pageBackground, background, interactionTheme, panels })` with the complete current appearance snapshot. `panels` matches existing registrations by frame element; navigation still owns registration and page binding. Ordinary color changes preserve the scene captures; changed panel materials or blur settings replace only their affected presentation resources.
