<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'ts',
			code: "import { createSpatialTheme } from '@spatial-elements/sveltekit';\n\nexport const light = createSpatialTheme({\n  id: 'collection', name: 'Collection',\n  sectionBackgrounds: { standard: '#ffffff', muted: '#f5f7f9' }\n});\nexport const dark = createSpatialTheme({\n  ...light,\n  background: '#121923',\n  sceneBackground: { tint: '#0e1622', tintIntensity: 0.86 },\n  panelTheme: { ...light.panelTheme, tint: '#172434', tintOpacity: 0.82 },\n  dockedPanelTheme: { ...light.dockedPanelTheme, tint: '#172434', tintOpacity: 0.94 },\n  sectionTheme: { ...light.sectionTheme, tint: '#172434', tintOpacity: 0.9 },\n  sectionBackgrounds: { standard: '#172434', muted: '#243548' },\n  colors: { ink: '#edf4fc', body: '#c8d6e7', accent: '#80bfff', onAccent: '#102438', tabBackground: '#243548' },\n  minimapTheme: { ...light.minimapTheme, viewportColor: '#80bfff' },\n  interactionTheme: { ...light.interactionTheme, outlineColor: '#80bfff' }\n});\n"
		},
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { BrandStageShell, ButtonGroup, resolveSpatialThemeRadii } from '@spatial-elements/sveltekit';\n  import { light, dark } from './themes';\n  let { children } = $props();\n  let colorScheme = $state\u003c'light' | 'dark'>('light');\n  const theme = $derived(colorScheme === 'dark' ? dark : light);\n\u003c/script>\n\n\u003cBrandStageShell {theme} {colorScheme}>\n  \u003cButtonGroup label=\"Appearance\"\n    shape={{ ...theme.panelShape, radius: resolveSpatialThemeRadii(theme).control }} theme={theme.panelTheme}\n    items={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}\n    value={colorScheme} onchange={(value) => { colorScheme = value === 'dark' ? 'dark' : 'light'; }} />\n  {@render children()}\n\u003c/BrandStageShell>\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Themes and appearance' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Themes and appearance',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'introduction',
			title: 'Introduction',
			headline: 'Introduction',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The host application owns theme preference, system detection, persistence and the switch UI.
				Spatial Elements accepts a resolved theme and updates its DOM, panels, minimap, hover
				outline and HDR backdrop without resetting the model, camera, zoom or fullscreen state.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'define-two-palettes',
			title: 'Define two palettes',
			headline: 'Define two palettes',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Create a complete <code>SpatialTheme</code> for each palette, keeping the same
				<code>id</code>
				and <code>name</code>. The ID is a namespace, not a light/dark identifier.
				<code>colors</code>, <code>panelTheme</code>, <code>dockedPanelTheme</code>,
				<code>sectionBackgrounds</code>, legacy <code>sectionTheme</code>, <code>minimapTheme</code>
				and <code>interactionTheme</code> settings describe both palettes; there is no separate set of
				dark-color properties.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				<code>sceneBackground</code> is optional. Its <code>blurriness</code>, <code>tint</code> and
				<code>tintIntensity</code>
				fields override the corresponding element background fields. Removing an override restores the
				element's settings. It changes the visible HDR backdrop, not HDR lighting, model materials or
				asset identity. <code>background</code> remains the flat page color.
			</p>
			<p>
				Set <code>sectionBackgrounds</code> for every light/dark palette. New standard/muted section
				surfaces use these colors independently of glass/frosted panel tint; changing only legacy
				<code>sectionTheme.tint</code>
				does not recolor a new <code>section.background</code> surface. ContentPage can override the
				flat page color with its <code>background</code> prop without modifying either section colors
				or the shared theme.
			</p>
			<p>
				<code>radii: &#123; control: 12, panel: 16 &#125;</code> separates cards, small controls and
				media thumbnails from larger panels and section groups. An explicitly authored legacy
				<code>panelShape.radius</code>
				supplies both roles until overridden. Use <code>resolveSpatialThemeRadii(theme)</code> when
				building custom controls; it supports older themes with no <code>radii</code> group. Content insets
				remain separate from radius values.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'supply-the-resolved-theme',
			title: 'Supply the resolved theme',
			headline: 'Supply the resolved theme',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				<code>colorScheme</code> is optional and accepts only <code>light</code> or
				<code>dark</code>. It sets the wrapper's CSS <code>color-scheme</code>, including native
				form controls. The library never reads <code>matchMedia</code>, writes storage or modifies
				the document's global preference. A host can use two buttons, three buttons, a menu, or no
				switch at all. Update the <code>theme</code> prop with the chosen palette; do not key/recreate
				the shell.
			</p>
			<p>
				Basics is permanently light. The <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/apps/website/README.md"
					>Showcase</a
				>
				provides <strong>Light / Dark</strong> in its right satellite (inside the menu on small
				screens). It follows the operating system until an explicit choice is made; that choice
				survives reloads in session storage. Its early HTML bootstrap and SSR preview styles apply
				the palette before hydration, and blocked storage remains usable. The former three-state
				demo remains an isolated regression fixture at <code>/proof/theming</code>. Applications
				with a CSP should authorize their bootstrap using their usual nonce/hash policy.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'reuse-buttongroup',
			title: 'Reuse ButtonGroup',
			headline: 'Reuse ButtonGroup',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>ButtonGroup</code> is a controlled, theme-independent choice component inside a
				<code>Stage</code>
				or <code>BrandStageShell</code>, with the same panel surface and selected treatment as the
				detail/fullscreen switch. Place it beside other panels rather than nesting it inside a
				<code>Panel</code>.
			</p>
			<table>
				<thead>
					<tr>
						<th>Property</th>
						<th>Meaning</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>items</code></td>
						<td
							>Readonly array of <code
								>&#123; value, label, tooltip?, disabled?, selection? &#125;</code
							>. Values must be unique.</td
						>
					</tr>
					<tr>
						<td><code>value</code></td>
						<td>Selected value; omit to leave all buttons unselected.</td>
					</tr>
					<tr>
						<td><code>onchange</code></td>
						<td>Called with the clicked value, including clicks on the current selection.</td>
					</tr>
					<tr>
						<td><code>label</code></td>
						<td>Accessible name of the group.</td>
					</tr>
					<tr>
						<td><code>content</code></td>
						<td
							>Optional <code>Snippet&lt;[ButtonGroupItem]&gt;</code> for icons or custom content. Otherwise
							displays the label.</td
						>
					</tr>
					<tr>
						<td><code>iconOnly</code></td>
						<td>Fixed 40px button width; default false uses intrinsic text width.</td>
					</tr>
					<tr>
						<td><code>shape</code>, <code>theme</code></td>
						<td
							>Same appearance contract as Panel. Finite radius values are clamped only at zero;
							nonfinite values use 12px. Content inset is zero. Pass the resolved theme control
							radius for theme-aware controls.</td
						>
					</tr>
					<tr>
						<td><code>disabled</code>, <code>visible</code></td>
						<td>Disable the group or temporarily hide its contents.</td>
					</tr>
					<tr>
						<td
							><code>focusReactive</code>, <code>focusAnchor</code>,
							<code>transitionGroup</code></td
						>
						<td>Optional integration with stage focus and transitions.</td>
					</tr>
				</tbody>
			</table>
			<p>
				Each label also provides its default tooltip; the host supplies the language. Buttons expose <code
					>aria-pressed</code
				>, native keyboard activation and focus outlines. The optional <code>selection</code> strength
				fades the selected background independently of semantic selection, as used by the detail button
				while zooming. The component does not store state or know about themes or languages.
			</p>
			<p>
				Custom core integrations can call <code
					>StageExperience.updateAppearance(&#123; pageBackground, background, interactionTheme,
					panels &#125;)</code
				>
				with the complete current appearance snapshot. <code>panels</code> matches existing registrations
				by frame element; navigation still owns registration and page binding. Ordinary color changes
				preserve the scene captures; changed panel materials or blur settings replace only their affected
				presentation resources.
			</p>
		</div></Section
	>
</WebsitePage>
