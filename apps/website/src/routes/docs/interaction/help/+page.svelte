<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { BrandStageShell, type SpatialMessagesInput } from '@spatial-elements/sveltekit';\n  import { theme } from '$lib/theme';\n\n  let { children } = $props();\n  const messages = {\n    controls: {\n      help: '3D-Steuerung',\n      closeHelp: 'Hilfe schließen',\n      detailView: 'Detailansicht',\n      fullscreen: 'Vollbild'\n    },\n    interactionHelp: {\n      title: 'In 3D erkunden',\n      rotate: 'Drehen',\n      zoom: 'Zoomen',\n      pan: 'Verschieben',\n      mouseRotate: 'Mit gedrückter linker Maustaste ziehen',\n      mouseZoom: 'Mausrad bewegen',\n      mousePan: 'Mit gedrückter rechter Maustaste ziehen',\n      mouseNavigationHint: 'Nutzen Sie alternativ eine {spacemouse} zur Navigation.',\n      touchRotate: 'Mit einem Finger ziehen',\n      touchZoom: 'Zwei Finger auseinander- oder zusammenziehen',\n      touchPan: 'Zwei Finger gemeinsam bewegen',\n      touchHint: '3D · Mit einem Finger drehen',\n      touchScrollHint: 'Außerhalb des Modells berühren, um die Seite zu scrollen.'\n    }\n  } satisfies SpatialMessagesInput;\n\u003c/script>\n\n\u003cBrandStageShell {theme} {messages}>\n  {@render children?.()}\n\u003c/BrandStageShell>\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Interface texts and help' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Interface texts and help',
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
				Spatial Elements supplies English interface copy. The host application owns the locale,
				translations and language switching. Pass a <code>messages</code> object to the persistent
				<code>BrandStageShell</code>; no translation library or automatic browser-language detection
				is required.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				All groups and individual keys are optional. Omitted or <code>undefined</code> values fall back
				to their English defaults, including when only one key in a group is translated. Supply plain
				text, not HTML. Translate whole phrases so their order is not constrained by the component. Empty
				strings are preserved; do not use them for accessible labels.
			</p>
			<p>
				Updating <code>messages</code> updates the visible help, icon-button accessible names and
				tooltips without remounting the shell or resetting the user's learning state. For example,
				pass <code>messages=&#123;translations[locale]&#125;</code> with a reactive
				<code>locale</code>, or derive the object from your existing i18n system. Product titles,
				feature descriptions and other authored content continue to come from application data.
			</p>
			<p>
				Both packages export <code>SpatialMessages</code>, <code>SpatialMessagesInput</code>,
				<code>defaultSpatialMessages</code>
				and <code>resolveSpatialMessages</code>. Use the input type for translation dictionaries:
				unlike the resolved type, it does not require your application to immediately supply newly
				added keys. <code>resolveSpatialMessages(input)</code> returns an independent, complete dictionary.
				Defaults are immutable.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'available-strings',
			title: 'Available strings',
			headline: 'Available strings',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Key</th>
						<th>English default / use</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td><code>controls.help</code></td>
						<td><code>3D controls</code> — icon-button accessible name and tooltip</td>
					</tr>
					<tr>
						<td><code>controls.closeHelp</code></td>
						<td><code>Close help</code> — close-button accessible name and tooltip</td>
					</tr>
					<tr>
						<td><code>controls.detailView</code></td>
						<td><code>Detail view</code> — detail-mode button accessible name and tooltip</td>
					</tr>
					<tr>
						<td><code>controls.fullscreen</code></td>
						<td><code>Fullscreen</code> — fullscreen-mode button accessible name and tooltip</td>
					</tr>
					<tr>
						<td><code>interactionHelp.title</code></td>
						<td><code>Explore in 3D</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.rotate</code></td>
						<td><code>Rotate</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.zoom</code></td>
						<td><code>Zoom</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.pan</code></td>
						<td><code>Pan</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.mouseRotate</code></td>
						<td><code>Drag with the left mouse button</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.mouseZoom</code></td>
						<td><code>Use the scroll wheel</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.mousePan</code></td>
						<td><code>Drag with the right mouse button</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.mouseNavigationHint</code></td>
						<td><code>Alternatively, use a &#123;spacemouse&#125; to navigate.</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.touchRotate</code></td>
						<td><code>Drag with one finger</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.touchZoom</code></td>
						<td><code>Pinch with two fingers</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.touchPan</code></td>
						<td><code>Drag with two fingers</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.touchHint</code></td>
						<td><code>3D · Drag with one finger to rotate</code></td>
					</tr>
					<tr>
						<td><code>interactionHelp.touchScrollHint</code></td>
						<td><code>Touch outside the model to scroll the page.</code></td>
					</tr>
				</tbody>
			</table>
			<p>
				Use <code>controls</code> for control labels/tooltips and <code>interactionHelp</code> for the
				instructional content. Future package controls can add keys to this same configuration, with English
				fallbacks. There are currently no AR controls or corresponding message keys.
			</p>
			<p>
				The help displays compact mouse or touch diagrams beside the short <code>rotate</code>,
				<code>zoom</code>
				and <code>pan</code> labels. Mouse buttons, the wheel and touch-motion arrows use
				<code>theme.colors.accent</code>. The longer <code>mouse*</code> / <code>touch*</code>
				instructions remain in the accessible definition list for screen readers, without taking up visible
				space. Translate these descriptions as well as the short labels. Touch help also displays
				<code>touchScrollHint</code> below the diagrams.
			</p>
			<p>
				Mouse help displays <code>mouseNavigationHint</code> below the same separator. Its
				<code>&#123;spacemouse&#125;</code>
				placeholder inserts a link labelled <strong>SpaceMouse</strong> to
				<code>https://3dconnexion.com/</code>, opening in a new tab. Keep or reposition the
				placeholder anywhere in your translated sentence; the rest is escaped plain text. Omitting
				the placeholder displays your text without a link. No translated HTML or configurable URL is
				needed. The touch scroll hint remains unchanged.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'detail-page-view-switch',
			title: 'Detail-page view switch',
			headline: 'Detail-page view switch',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Enhanced detail pages start in <strong>Detail view</strong>. A two-button group switches
				between the page and <strong>Fullscreen</strong>; the help button sits 8px to its left. The
				group shares the help button's panel material and icon color, uses the configured panel
				radius on its outside corners, and highlights the selected button with the section
				navigation's 8% body-color fill, without an underline or additional theme setting. A
				page-layout icon represents the detail view, and an expand icon represents fullscreen. Both
				buttons expose their selection through <code>aria-pressed</code>.
			</p>
			<p>
				Fullscreen uses the browser Fullscreen API. If it is missing, disabled or rejects the
				request, the same view fills the browser viewport. Only the model/background, expanded
				minimap, help and view switch remain visible. Dragging, pinching, panning and wheel zoom
				work across the canvas, including empty background; geometry picking, hover glow and the
				introductory pointer preview are disabled. SpaceMouse continues to use the same camera. The
				minimap stays in the close-up size and corner position, follows the live model orientation
				and shows the camera's visible region. Its ordinary hover and reset behavior remain
				available. On narrow phones, the control row moves just below the expanded minimap to keep
				both usable without shrinking the minimap.
			</p>
			<p>
				Select <strong>Detail view</strong> to return. Browser fullscreen exit and Escape also synchronize
				the switch; the fallback supports Escape directly. Scroll styles and the previous page position
				are restored on exit or navigation. The touch-only page-scroll hint is hidden while fullscreen
				is active. These controls require the enhanced 3D renderer; missing fullscreen support alone never
				hides the switch.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'detail-page-interaction-help',
			title: 'Detail-page interaction help',
			headline: 'Detail-page interaction help',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Enhanced detail pages include a 40 × 40 CSS-pixel help button and an 80 × 40 view switch at
				the upper right of the model area, next to the summary panel on desktop. The switch's gap to
				the summary is 12px smaller than its gap below the header (at least 16px). During close-up
				the controls and summary's projected top-left corner move together, keeping their gap as the
				panel grows and fades out past the upper-right viewport edge. The switch reaches its final
				10px top/right inset inside the usable viewport, excluding the scrollbar, exactly when the
				panels become transparent; help stays 8px to its left. The minimap starts expanding slightly
				later but also reaches its final position and size at that same endpoint. No peripheral
				movement continues after clearance. All poses read the same damped camera position and
				reverse with zoom, without a separate animation or delay. On stacked layouts the controls
				travel directly from the model column to the corner while the summary below follows its
				ordinary exit path. They use the theme's panel surface, tint, blur, shadow and ink color.
				Mouse hover uses the same 8% body-color highlight as the section submenu, without movement
				or tilt. The help button's accessible name and native tooltip come from <code
					>controls.help</code
				>; the button contains no visible text.
			</p>
			<p>
				The non-modal help opens next to this button, stays within the viewport and adapts the
				gesture descriptions to actual mouse/touch input. Its surface uses the same panel renderer,
				including WebGPU refraction in the <code>glass</code> theme. Clicking the button opens persistent
				help. Keyboard activation focuses its close button; Escape or the close button restores focus
				when appropriate. Automatically displayed help does not move keyboard focus. The user can move
				the pointer into the help or focus its controls and read without a time limit.
			</p>
			<p>
				Before the first model interaction, sustained mouse hover on model geometry opens the help
				after 600ms. Leaving the geometry, help and button hides automatic help after 350ms;
				returning to the geometry can show it again. Moving back during this delay keeps it open.
				Manually opened help stays open when the pointer leaves. A real model drag, wheel zoom or
				SpaceMouse interaction suppresses all subsequent automatic help for the tab session, even if
				performed before the first hover delay. Touch devices initially show a short,
				non-interactive hint; dragging the model works on the first contact, without dismissing
				anything first. The hint disappears after model interaction. The icon button can still
				reopen the help.
			</p>
			<p>
				Learning state is shared across products and brands in the same application/origin and is
				retained in <code>sessionStorage</code> under
				<code>spatial-elements:interaction-guidance:v1</code>. It survives page reloads in the same
				tab and resets with a new tab session. If storage is unavailable, an in-memory state lasts
				until the document is replaced. No cookies, tracking or network requests are involved. To
				inspect the first-use behavior again during development, clear this key and reload, or start
				a fresh browser context.
			</p>
			<p>
				Before the first manual interaction, nearby mouse movement can gently orbit the model by up
				to 2.5° on each axis. The motion settles to rest; it does not continuously animate. Starting
				a drag takes over the currently visible pose without a jump. Manual model interaction
				disables this preview for the session. Reduced-motion preferences disable the introductory
				motion and the button's color transition. Touch uses direct manipulation; no orientation
				sensor permission or idle animation is required.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'related-panel-options',
			title: 'Related panel options',
			headline: 'Related panel options',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>Panel</code> accepts <code>pointerReactive=&#123;true&#125;</code> for proximity lift
				and tilt, <code>&quot;lift&quot;</code> for a 2px mouse-only lift, or <code>false</code> for
				no motion. The approach band outside a panel is bounded to 12–32px.
				<code>focusReactive=&#123;false&#125;</code>
				keeps a panel available when model close-up fades the surrounding UI;
				<code>focusReactive=&quot;top-right&quot;</code>
				also moves it to the viewport corner. An optional <code>focusAnchor</code> panel frame
				couples that neighbour's projected top-left edge to the control's exit path. Both finish
				with the panel fade, preserving their authored spacing. Defaults remain <code>true</code>
				for both reactive options. The built-in help button uses
				<code>pointerReactive=&#123;false&#125;</code>,
				<code>focusReactive=&quot;top-right&quot;</code> and the summary frame as its anchor.
			</p>
			<p>
				For native overlays, <code>nativeContent</code> retains the panel's content in its DOM owner
				(for example, a <code>popover</code>) while rendering its glass surface through the stage.
				Combine it with <code>pointerReactive=&#123;false&#125;</code>,
				<code>focusReactive=&#123;false&#125;</code>
				and <code>visible=&#123;open&#125;</code>. Native layout determines its size. For an overlay
				anchored to moving stage content, supply
				<code>nativeLayout=&#123;() =&gt; positionOverlay()&#125;</code>: the stage calls it after
				committing the anchor DOM positions, then measures and draws the overlay surface in that
				same frame. The callback should only update layout, without dispatching another layout
				event. For external changes, signal <code>STAGE_PANEL_LAYOUT_EVENT</code> to request a frame.
				Visibility changes and resize observation update its surface automatically. The built-in help
				uses this internally; hosts do not need to construct either control.
			</p>
		</div></Section
	>
</WebsitePage>
