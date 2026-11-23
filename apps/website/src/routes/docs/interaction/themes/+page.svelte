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
	import WebsitePage from '#lib/WebsitePage.svelte';
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
	>
		<div class="prose">
			<p>
				The host application owns theme preference, system detection, persistence and the switch UI.
				Spatial Elements accepts a resolved theme and updates its DOM, panels, minimap, hover
				outline and HDR backdrop without resetting the model, camera, zoom or fullscreen state.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'define-two-palettes',
			title: 'Define two palettes',
			headline: 'Define two palettes',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Create a complete <a href="/docs/reference/types/#spatial-theme">
					<code>SpatialTheme</code>
				</a>
				for each palette, keeping the same
				<a href="/docs/reference/types/#spatial-theme-id"><code>id</code></a>
				and <a href="/docs/reference/types/#spatial-theme-name"><code>name</code></a>. The ID is a
				namespace, not a light/dark identifier.
				<a href="/docs/reference/types/#spatial-theme-colors"><code>colors</code></a>,
				<a href="/docs/reference/types/#spatial-theme-panel-theme"><code>panelTheme</code></a>,
				<a href="/docs/reference/types/#spatial-theme-docked-panel-theme">
					<code>dockedPanelTheme</code>
				</a>,
				<a href="/docs/reference/types/#spatial-theme-section-backgrounds">
					<code>sectionBackgrounds</code>
				</a>, legacy
				<a href="/docs/reference/types/#spatial-theme-section-theme"><code>sectionTheme</code></a>,
				<a href="/docs/reference/types/#spatial-theme-minimap-theme"><code>minimapTheme</code></a>
				and
				<a href="/docs/reference/types/#spatial-theme-interaction-theme">
					<code>interactionTheme</code>
				</a> settings describe both palettes; there is no separate set of dark-color properties.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				<a href="/docs/reference/types/#spatial-theme-scene-background">
					<code>sceneBackground</code>
				</a>
				is optional. Its
				<a href="/docs/reference/types/#background-settings-blurriness"><code>blurriness</code></a>,
				<a href="/docs/reference/types/#background-settings-tint"><code>tint</code></a>
				and
				<a href="/docs/reference/types/#background-settings-tint-intensity">
					<code>tintIntensity</code>
				</a>
				fields override the corresponding element background fields. Removing an override restores the
				element's settings. It changes the visible HDR backdrop, not HDR lighting, model materials or
				asset identity.
				<a href="/docs/reference/types/#spatial-theme-background"><code>background</code></a> remains
				the flat page color.
			</p>
			<p>
				Set <a href="/docs/reference/types/#spatial-theme-section-backgrounds">
					<code>sectionBackgrounds</code>
				</a>
				for every light/dark palette. New standard/muted section surfaces use these colors independently
				of glass/frosted panel tint; changing only legacy
				<a href="/docs/reference/types/#spatial-section-theme-tint">
					<code>sectionTheme.tint</code>
				</a>
				does not recolor a new
				<a href="/docs/reference/types/#spatial-element-section-definition-background">
					<code>section.background</code>
				</a>
				surface. ContentPage can override the flat page color with its
				<a href="/docs/reference/types/#spatial-theme-background"><code>background</code></a> prop without
				modifying either section colors or the shared theme.
			</p>
			<p>
				<code>radii: &#123; control: 12, panel: 16 &#125;</code> separates cards, small controls and
				media thumbnails from larger panels and section groups. An explicitly authored legacy
				<code>panelShape.radius</code>
				supplies both roles until overridden. Use <code>resolveSpatialThemeRadii(theme)</code> when
				building custom controls; it supports older themes with no
				<a href="/docs/reference/types/#spatial-theme-radii"><code>radii</code></a> group. Content insets
				remain separate from radius values.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'supply-the-resolved-theme',
			title: 'Supply the resolved theme',
			headline: 'Supply the resolved theme',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				<a href="/docs/reference/components/#brand-stage-shell-color-scheme">
					<code>colorScheme</code>
				</a>
				is optional and accepts only <code>light</code> or
				<code>dark</code>. It sets the wrapper's CSS <code>color-scheme</code>, including native
				form controls. The library never reads <code>matchMedia</code>, writes storage or modifies
				the document's global preference. A host can use two buttons, three buttons, a menu, or no
				switch at all. Update the
				<a href="/docs/reference/components/#brand-stage-shell-theme"><code>theme</code></a> prop with
				the chosen palette; do not key/recreate the shell.
			</p>
			<p>
				The <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/apps/website/README.md"
				>
					Showcase
				</a>
				provides <strong>Light / Dark</strong> in its right satellite (inside the menu on small
				screens). It renders a light fallback and restores an explicit choice from local storage
				after hydration. Blocked storage remains usable. The three-state theme demo remains an
				isolated regression fixture at <code>/proof/theming</code>.
			</p>
			<p>
				Visit <a href="/showcase/exclusive/">Exclusive</a> to compare a complete visual identity: Watches-inspired
				glass, gold accents, 22px corners and a visible studio environment replace the website's green
				frosted theme. Its light palette uses smoky charcoal glass; dark mode deepens the surfaces and
				environment further. Both work on the collection and its detail pages. The shared shell selects
				the theme by route while keeping its namespace ID, menu content and breadcrumb hierarchy. Leaving
				Exclusive restores the standard theme.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'reuse-buttongroup',
			title: 'Reuse ButtonGroup',
			headline: 'Reuse ButtonGroup',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<code>ButtonGroup</code> is a controlled, theme-independent choice component inside a
				<code>Stage</code>
				or <a href="/docs/reference/components/#brand-stage-shell"><code>BrandStageShell</code></a>,
				with the same panel surface and selected treatment as the detail/fullscreen switch. Place it
				beside other panels rather than nesting it inside a
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
						<td>
							<a href="/docs/reference/components/#brand-stage-shell-items"><code>items</code></a>
						</td>
						<td>
							Readonly array of <code>
								&#123; value, label, tooltip?, disabled?, selection? &#125;
							</code>. Values must be unique.
						</td>
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
						<td>
							<a href="/docs/reference/types/#spatial-element-media-item-label">
								<code>label</code>
							</a>
						</td>
						<td>Accessible name of the group.</td>
					</tr>
					<tr>
						<td><code>content</code></td>
						<td>
							Optional <code>Snippet&lt;[ButtonGroupItem]&gt;</code> for icons or custom content. Otherwise
							displays the label.
						</td>
					</tr>
					<tr>
						<td><code>iconOnly</code></td>
						<td>Fixed 40px button width; default false uses intrinsic text width.</td>
					</tr>
					<tr>
						<td>
							<code>shape</code>,
							<a href="/docs/reference/components/#brand-stage-shell-theme"><code>theme</code></a>
						</td>
						<td>
							Same appearance contract as Panel. Finite radius values are clamped only at zero;
							nonfinite values use 12px. Content inset is zero. Pass the resolved theme control
							radius for theme-aware controls.
						</td>
					</tr>
					<tr>
						<td><code>disabled</code>, <code>visible</code></td>
						<td>Disable the group or temporarily hide its contents.</td>
					</tr>
					<tr>
						<td>
							<code>focusReactive</code>, <code>focusAnchor</code>,
							<code>transitionGroup</code>
						</td>
						<td>Optional integration with stage focus and transitions.</td>
					</tr>
				</tbody>
			</table>
			<p>
				Each label also provides its default tooltip; the host supplies the language. Buttons expose <code>
					aria-pressed
				</code>, native keyboard activation and focus outlines. The optional <code>selection</code> strength
				fades the selected background and icon/text color independently of semantic selection, as used
				by the detail button while zooming. The component does not store state or know about themes or
				languages.
			</p>
			<p>
				Custom core integrations can call <code>
					StageExperience.updateAppearance(&#123; pageBackground, background, interactionTheme,
					panels &#125;)
				</code>
				with the complete current appearance snapshot. <code>panels</code> matches existing registrations
				by frame element; navigation still owns registration and page binding. Ordinary color changes
				preserve the scene captures; changed panel materials or blur settings replace only their affected
				presentation resources.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'compare-themes',
			title: 'Compare complete themes',
			headline: 'Compare complete themes',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Open <a href="/showcase/industrial/">Industrial</a> for a compact blue theme or
				<a href="/showcase/exclusive/">Exclusive</a> for gold accents and glass surfaces. Switch between
				light and dark modes, then open a detail page. The route keeps its identity across the collection,
				summary, controls and content.
			</p>
			<p>
				For ordinary HTML surrounding the stage, coordinate the <a
					href="https://page-sections.bergjohann.com/docs/reference/types/#page-theme"
				>
					PageTheme
				</a>
				on PageShell with the
				<a href="/docs/reference/types/#spatial-theme"><code>SpatialTheme</code></a>. Give both the
				same semantic text, accent and section colors.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'borders',
			title: 'Border colors',
			headline: 'Border colors',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<p>
			<a href="/docs/reference/types/#spatial-theme-colors">
				<code>colors.border</code> and <code>colors.panelBorder</code>
			</a> control two independent edges. The first applies to cards, icon buttons, ButtonGroups and media
			thumbnails. The second applies to panels, popups, the main menu and detail navigation. Docked main
			menus and scroll headers show only the bottom edge.
		</p>
		<p>
			They map to <code>--ps-border</code> and <code>--ps-panel-border</code>. Defaults mix the ink
			color at 18% and 12% respectively. Set either to <code>transparent</code> to hide the edge
			without changing geometry. A standalone Panel also accepts <code>borderColor</code>. Selection
			and keyboard focus keep their accent outlines.
		</p>
	</Section>
	<Section
		section={{
			id: 'shadows',
			title: 'Shared shadows',
			headline: 'Shared shadows',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Page Sections and spatial panels share three CSS controls: <code>--ps-shadow-color</code>
				(default black), <code>--ps-shadow-size</code> and <code>--ps-shadow-intensity</code> (both default
				1). Set them on your page shell or a themed ancestor. A value of 0 removes the size or intensity;
				transparent removes the color.
			</p>
			<p>
				The material's <a href="/docs/reference/types/#spatial-theme-panel-theme">
					<code>panelTheme</code>
				</a>
				and
				<a href="/docs/reference/types/#spatial-theme-docked-panel-theme">
					<code>dockedPanelTheme</code>
				</a> keep their base shadow intensity. The CSS intensity multiplies that strength, so Industrial
				and Exclusive retain their individual appearance. GPU glass reads these controls when the theme
				or responsive styles change; scrolling does not poll styles or add a render loop.
			</p>
			<p>
				Set <a href="/docs/reference/types/#stage-panel-theme-shadow-color">
					<code>panelTheme.shadowColor</code>
				</a>
				to override the shared color for that material, or
				<a href="/docs/reference/types/#spatial-docked-panel-theme-shadow-color">
					<code>dockedPanelTheme.shadowColor</code>
				</a>
				for the scroll header and tabs. Omit these fields to inherit <code>--ps-shadow-color</code>.
				The same rule applies to CSS panels and GPU glass, including carousel panels.
			</p>
			<p>
				For complete CSS shadow replacements, use <code>--ps-navigation-shadow</code>,
				<code>--ps-popup-shadow</code>, <code>--ps-surface-shadow</code>, or
				<code>--ps-panel-shadow</code> for spatial CSS panels. A complete CSS shadow cannot describe a
				GPU material; use the three shared controls for changes that must also affect refractive glass.
			</p>
			<p>
				See the <a href="https://page-sections.bergjohann.com/docs/design-system/">
					Page Sections design system
				</a>
				and <a href="https://page-sections.bergjohann.com/docs/components/">shared components</a> for
				the common controls, popup surfaces and atomic component hierarchy. Header buttons remain borderless;
				panel edges and keyboard focus are independent of shadows.
			</p>
		</div>
	</Section>
</WebsitePage>
