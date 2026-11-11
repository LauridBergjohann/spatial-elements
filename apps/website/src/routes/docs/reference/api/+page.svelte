<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'ts',
			code: "geometry: { low: '/assets/chair-low.glb', high: '/assets/chair-high.glb' }\n// A tiny model can serve both roles, with one cached fetch and decode:\ngeometry: { low: '/assets/cube.glb', high: '/assets/cube.glb' }\n"
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'API reference' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'API reference',
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
				For a runnable category/detail setup, begin with <a
					href="/docs/foundations/first-experience/">Getting started</a
				>. This reference describes the current public API.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'ownership-which-setting-belongs-where',
			title: 'Ownership: which setting belongs where?',
			headline: 'Ownership: which setting belongs where?',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Owner</th>
						<th>Purpose</th>
						<th>Defined in</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>SpatialElementData</td>
						<td>One element's content, model, lighting and detail presentation</td>
						<td>Application data / CMS, consumed by page load functions</td>
					</tr>
					<tr>
						<td>SpatialTheme</td>
						<td>Shared brand identity, colors and panel materials</td>
						<td>Persistent layout, usually via createSpatialTheme</td>
					</tr>
					<tr>
						<td>BrandStageShell</td>
						<td>Renderer lifetime, interface translations, GPU budget and decoder infrastructure</td
						>
						<td>Persistent +layout.svelte</td>
					</tr>
					<tr>
						<td>ContentPageData</td>
						<td>Category title, introduction and breadcrumbs</td>
						<td>Category +page.svelte or its load data</td>
					</tr>
					<tr>
						<td>SpatialListItem</td>
						<td>Derived link, summary and assets for an element occurrence</td>
						<td>getSpatialListItems(elements, basePath)</td>
					</tr>
					<tr>
						<td>Section definition</td>
						<td
							>Anchor/navigation label, optional visible headline, background and local CSS
							overrides</td
						>
						<td>Content/detail page</td>
					</tr>
				</tbody>
			</table>
			<p>
				There is no separate SpatialStageConfig document. The adapter derives its internal renderer
				scene from the active page. You do not need a layout-level catalog, an active element ID, or
				a duplicate list of models.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'element-data',
			title: 'Element data',
			headline: 'Element data',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				All fields are flat. See <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/spatial-element/types.ts"
					>SpatialElementData TSDoc</a
				>.
			</p>
			<table>
				<thead>
					<tr>
						<th>Field</th>
						<th>Required/default</th>
						<th>Meaning</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>id</td>
						<td>Required</td>
						<td>Stable identity within the theme namespace; use URL-safe IDs.</td>
					</tr>
					<tr>
						<td>title</td>
						<td>Required</td>
						<td>Visible title and default document title.</td>
					</tr>
					<tr>
						<td>geometry</td>
						<td>Required</td>
						<td
							>Both low and high: model URL strings, or versioned resource descriptors from an asset
							pipeline. Low for categories/transitions; High for detail. Same URLs share a cached
							fetch/decode.</td
						>
					</tr>
					<tr>
						<td>hdr</td>
						<td>Required</td>
						<td
							>Detail lighting and background HDR. Category lighting is set independently on
							ContentPage.hdr.</td
						>
					</tr>
					<tr>
						<td>brandId</td>
						<td>Inherited from shell</td>
						<td>Optional assertion: must equal theme.id when supplied.</td>
					</tr>
					<tr>
						<td>pageTitle</td>
						<td>title</td>
						<td>Browser document title.</td>
					</tr>
					<tr>
						<td>eyebrow</td>
						<td>Empty</td>
						<td>Short series/category label.</td>
					</tr>
					<tr>
						<td>features</td>
						<td>[]</td>
						<td>Summary entries: &#123; label, marker? &#125;.</td>
					</tr>
					<tr>
						<td>action</td>
						<td>Absent</td>
						<td
							>&#123; label, href?, ariaLabel?, semanticId? &#125;. With href renders a link;
							without it renders a button. The host owns business behavior.</td
						>
					</tr>
					<tr>
						<td>background</td>
						<td>&#123; blurriness: 0.2, tint: '#b6deff', tintIntensity: 0.3 &#125;</td>
						<td
							>HDR background presentation; independent of model lighting and theme.background.
							Supply the full settings object when overriding.</td
						>
					</tr>
					<tr>
						<td>model</td>
						<td>Imported pose/materials</td>
						<td
							>Optional rotation &#123;x,y,z&#125; in radians, excludeMeshes (exact mesh names),
							materialOverrides (physical material settings keyed by mesh name). Excluded context
							meshes remain visible on the main stage but do not determine fit, picking, outlines or
							minimaps.</td
						>
					</tr>
					<tr>
						<td>camera</td>
						<td>Automatic fit</td>
						<td
							>azimuth/elevation in degrees, fitPadding in CSS pixels, fitScale as a multiplier. On
							detail pages, enlargement may consume padding but stays inside the media fit rectangle
							so the media rail and summary remain clear.</td
						>
					</tr>
					<tr>
						<td>fallbackImage</td>
						<td>Absent</td>
						<td>Poster URL for loading, SSR and unavailable WebGPU. Recommended.</td>
					</tr>
					<tr>
						<td>fallbackImageSize</td>
						<td>Absent</td>
						<td>Actual poster pixel dimensions [width,height], not physical model dimensions.</td>
					</tr>
					<tr>
						<td>breadcrumbs</td>
						<td>[]</td>
						<td>&#123; label, href? &#125;; entries without href are plain text.</td>
					</tr>
					<tr>
						<td>media</td>
						<td>One minimap</td>
						<td
							>Entries with <code>id</code>, <code>kind</code> and <code>label</code>; kinds
							<code>minimap</code>, <code>image</code>, <code>video</code>, <code>youtube</code>.
							Detail pages always place one 3D/minimap entry first, including when
							<code>media: []</code>
							is supplied. See
							<a
								href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/design/layout/media-and-input.md"
								>media and input</a
							>
							for fields and lifecycle. The old source-less <code>drawing</code> entry is deprecated;
							replace it with an image.</td
						>
					</tr>
					<tr>
						<td>minimap</td>
						<td>Runtime fit defaults</td>
						<td
							>Per-element inset, modelScale, hoverModelScale, expandedHoverModelScale and
							dockedView. Shared colors belong in the theme.</td
						>
					</tr>
					<tr>
						<td>assetManifest</td>
						<td>Absent</td>
						<td>Advanced verified resource manifest. Not needed for a simple GLB.</td>
					</tr>
				</tbody>
			</table>
			<p>
				Category pages require an explicit ContentPage.hdr. No element supplies or overrides the
				category environment, including the first element. Detail pages use the selected element's
				hdr.
			</p>
			<p>
				An action without href does not install a click handler automatically. Use ordinary links or
				application-owned controls in Section children for custom application behavior. Theme and
				content options do not perform purchases, fetch content or own routing.
			</p>
			<p>
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/stageTypes.ts"
					>Model/camera/minimap types</a
				>
				document units and supported material properties.
				<a href="/docs/foundations/assets/">LOD and resource ownership</a> explain the advanced asset
				contract.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'geometry-details',
			title: 'Geometry details',
			headline: 'Geometry details',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				Both roles are mandatory. URLs identify resources independently of the Low/High role.
				Sharing a file does not produce an optimized version automatically. Distinct exports must
				share origin, axes and scale; there is no automatic alignment or decimation. Without
				generated metadata, Low bounds determine the shared model fit.
			</p>
			<p>
				Advanced pipelines can provide resource objects &#123;url, format, revision,
				requirements?&#125; instead of strings, plus geometry.assetToFrame, bounds, revision and
				status. For the same URL, resource metadata must agree; contradictory versions are rejected
				instead of downloading the same URL twice. Version changing content with a URL or resource
				revision. geometryFromLodPair converts existing generated pair metadata without carrying its
				redundant sourceUrl into authored element data. See <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/spatial-element/spatialElementGeometry.ts"
					>geometry TSDoc</a
				>.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'shared-theme',
			title: 'Shared theme',
			headline: 'Shared theme',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Themes can change at runtime. Pass the selected <code>theme</code> and optional resolved
				<code>colorScheme=&quot;light&quot;</code>
				or <code>&quot;dark&quot;</code> to <code>BrandStageShell</code>. Optional
				<code>theme.sceneBackground</code>
				overrides the visible HDR backdrop without changing model lighting. The host owns preference,
				storage and system detection. See
				<a href="/docs/interaction/themes/">Runtime themes and ButtonGroup</a>
				for complete examples and the generic <code>ButtonGroup</code> API.
			</p>
			<p>
				Use createSpatialTheme(&#123; id, name, ...overrides &#125;). Only id and name are required;
				each appearance group merges field-by-field with defaults. Every call returns independent
				objects. Existing complete SpatialTheme objects remain valid.
			</p>
			<table>
				<thead>
					<tr>
						<th>Group</th>
						<th>Purpose and helper defaults</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>id / name</td>
						<td>Namespace matching the route prefix / accessible brand name.</td>
					</tr>
					<tr>
						<td>background</td>
						<td>Flat page color: #eef1f4. This is not the HDR background.</td>
					</tr>
					<tr>
						<td>sceneBackground</td>
						<td
							>Optional partial overrides for the element's HDR backdrop: blurriness, tint,
							tintIntensity. Leaves model lighting unchanged.</td
						>
					</tr>
					<tr>
						<td>colors</td>
						<td
							>ink #173047, body #263c4d, accent #285c89, onAccent #ffffff, tabBackground #e4ebf1.</td
						>
					</tr>
					<tr>
						<td>panelShape</td>
						<td>radius 16 and contentInset 26, both in CSS pixels.</td>
					</tr>
					<tr>
						<td>radii</td>
						<td
							>control 12px for cards/small controls; panel 16px for panels/detached section groups.
							An explicitly authored panelShape.radius is the compatibility fallback for both roles;
							explicit radii fields win.</td
						>
					</tr>
					<tr>
						<td>sectionBackgrounds</td>
						<td
							>standard #ffffff and muted #f5f7f9, independent of glass/frosted panel material
							colors.</td
						>
					</tr>
					<tr>
						<td>panelTheme</td>
						<td
							>surface frosted, tint #ffffff, tintOpacity 0.65, backdropBlur 8px, shadowIntensity
							0.2, opacity 1. Further glass controls use runtime defaults.</td
						>
					</tr>
					<tr>
						<td>dockedPanelTheme</td>
						<td
							>Compact header/tabs: tint #ffffff, tintOpacity 0.92, backdropBlur 5px,
							shadowIntensity 0.2.</td
						>
					</tr>
					<tr>
						<td>sectionTheme</td>
						<td
							>Legacy section material: tint #ffffff, tintOpacity 0.8, backdropBlur 8px. New
							section.background roles use sectionBackgrounds instead.</td
						>
					</tr>
					<tr>
						<td>minimapTheme</td>
						<td
							>expandedHeight 240px, overlayColor #000000, overlayOpacity 0.35, overlayBlur 5px,
							contextOpacity 0, viewportColor from accent.</td
						>
					</tr>
					<tr>
						<td>interactionTheme</td>
						<td>outlineColor from accent; other picking/outline controls use runtime defaults.</td>
					</tr>
				</tbody>
			</table>
			<p>
				Color overrides do not modify GLB materials. Use element.model.materialOverrides for that.
				Opacity and tint strengths use 0..1. Panel surfaces are solid (CSS), frosted (CSS backdrop
				blur) and glass (GPU refraction). Glass can cost more GPU work; the helper chooses frosted.
			</p>
			<p>
				<code>radii</code> and <code>sectionBackgrounds</code> are optional on older manually constructed
				SpatialTheme objects; the factory resolves both groups. Radius values are finite, nonnegative
				CSS pixels: negative values clamp to zero and nonfinite values use the resolved fallback. A radius
				does not change contentInset.
			</p>
			<p>
				See <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/spatial-element/spatialTheme.ts"
					>createSpatialTheme</a
				>,
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/spatial-element/types.ts"
					>theme types</a
				>,
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/panelContext.ts"
					>panel controls</a
				>
				and
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/stageTypes.ts"
					>renderer controls</a
				> for all fields.
			</p>
			<p>
				Interface language is independent of the theme. Pass <code
					>messages: SpatialMessagesInput</code
				>
				to <code>BrandStageShell</code> to override control labels, accessible names, tooltips and
				3D-help instructions. Missing keys use English defaults. See
				<a href="/docs/interaction/help/">interface texts and help</a> for all keys and a complete translation
				example.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'svelte-components',
			title: 'Svelte components',
			headline: 'Svelte components',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Component</th>
						<th>Props and responsibility</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>BrandStageShell</td>
						<td
							>Required reactive theme; optional colorScheme (light/dark), messages, renderSettings,
							dracoDecoderPath, deviceOrientation (default false, for detail geometry/minimap),
							items: MenuItem[], brand/tools/menu snippets, left/right satellite snippets (Settings
							below XL), summary: SpatialSummarySnippet, and children. Persistent layout and
							renderer owner. No stage/catalog props.</td
						>
					</tr>
					<tr>
						<td>ButtonGroup</td>
						<td
							>Required items, label and shape; controlled value/onchange, optional theme, iconOnly
							and content snippet. Generic panel-backed choices owned by the host.</td
						>
					</tr>
					<tr>
						<td>ContentPage</td>
						<td
							>Required hdr: environment URL and page: ContentPageData; optional background: CSS
							color and children. background overrides the flat page color for this page in DOM and
							enhanced rendering, without changing HDR lighting or the shared theme. page.title is
							required; pageTitle defaults to title. Place visible headings and introductory text in
							child sections. Use leftSidebar, footer and showContentMenu for navigation.</td
						>
					</tr>
					<tr>
						<td>SpatialCardGridSection</td>
						<td
							>Required section: &#123;id,title,headline?,background?,style?&#125;, list:
							SpatialListItem[]. Optional cardSize, cardVariant, cardTone, mediaAspect, mediaFit,
							textAlign and itemSpan; see Cards below. Registers its own element occurrences.</td
						>
					</tr>
					<tr>
						<td>SpatialCarouselSection</td>
						<td
							>Same section/list; optional presentation: &#123;radius?,depth?&#125;, initialItemKey,
							onselectionchange(&#123;itemKey,spatialElementId&#125;). Radius controls model
							spacing, normalized around 0.48 (clamped 0.2..0.7); depth defaults to 700 CSS-world
							pixels (clamped 0..1200). The selected media fit and summary placement follow the
							shared responsive layout. Models, shadows and hit areas are clipped to the section
							surface: standard stays within the section; full extends horizontally to the viewport.</td
						>
					</tr>
					<tr>
						<td>SpatialListPage</td>
						<td
							>Convenience wrapper: ContentPageData fields directly as props, required hdr and
							spatialElements, optional sectionLink: &#123;href,label&#125;. For new composable
							pages prefer ContentPage with sections.</td
						>
					</tr>
					<tr>
						<td>SpatialElementPage</td>
						<td
							>Required spatialElement: SpatialElementData; optional children. Owns detail content,
							model selection and generated section navigation.</td
						>
					</tr>
					<tr>
						<td>Section</td>
						<td
							>Required section: &#123;id,title,headline?,background?,style?&#125;; optional
							children and HTML attributes/class. The presentation prop is used by spatial
							list/carousel wrappers. Detail sections automatically populate tabs.</td
						>
					</tr>
					<tr>
						<td>ContentGrid</td>
						<td
							>Optional children and HTML attributes/class. Places explicit ContentBlock children on
							the enclosing section's content grid; adds no outer padding.</td
						>
					</tr>
					<tr>
						<td>ContentBlock</td>
						<td
							>Optional span: number or &#123;xs?,s?,m?,l?&#125;, children and HTML
							attributes/class. Fills the row by default; responsive spans inherit mobile-first.</td
						>
					</tr>
				</tbody>
			</table>
			<p>
				Mount one active ContentPage or SpatialElementPage under each shell. Sections are children
				of that page; they are not independent pages. Section IDs must be stable, unique and start
				with a lowercase letter, followed by lowercase letters, digits or hyphens.
			</p>
			<h3>Carousel layout and summary content</h3>
			<p>
				Carousel sections use the ordinary content grid, heading gap and background rules. The
				selected media fit is a framing target, not a clipping boundary for neighbouring geometry.
				XS/S reserve a 66px title strip and show only the framework's title, optional eyebrow and
				detail arrow; without an eyebrow the 40px title block aligns to the bottom of that same
				strip. From M, the full summary has the matching detail-panel width and centers vertically
				in the fit area. Its height is intrinsic, capped at the fit height with local scrolling. The
				3XL carousel keeps the 2XL composition and 480px panel width.
			</p>
			<p>
				Define optional <code>BrandStageShell.summary</code> in the persistent brand layout. The
				exported
				<code>SpatialSummarySnippet</code> receives a <code>SpatialSummaryContext</code> containing
				common resolved
				<code>spatialElement</code> fields, <code>mode: 'detail' | 'carousel'</code>,
				<code>heading</code>, <code>contentInset</code> and catalog endpoint addresses. The default
				summary remains available when the snippet is omitted. Each summary has an inline-size query
				container named <code>spatial-summary</code>; use container queries for host-defined one-,
				two- or three-column content. Initial output must be synchronous and content-only; await
				required data in route load, and keep <code>svelte:head</code> outside the summary.
			</p>
			<p>
				The adapter distinguishes occurrences by section and <code>itemKey</code>. A product shown
				in two sections has two independent live summary instances. Carousel selection and
				responsive changes retain each occurrence's interactive state. Route-transfer activation
				belongs to the transition coordinator; matching a product ID alone is not sufficient to
				adopt another occurrence. See
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/design/layout/summary-snippets.md"
					>summary rendering and ownership</a
				> for the precise lifecycle and SSR boundaries.
			</p>
			<h3>Section headings and surfaces</h3>
			<p>
				<code>section.title</code> names the section in generated navigation and for accessibility.
				Only optional
				<code>section.headline</code> renders a visible heading. Omitting it also removes its
				heading gap; the section keeps an accessible label. Set <code>headline: title</code> explicitly
				when retaining an old visible heading.
			</p>
			<p>
				<code>section.background</code> is <code>&#123; color, size? &#125;</code>; omitted
				backgrounds resolve to transparent/standard. Color values are <code>transparent</code>,
				<code>standard</code>, <code>muted</code>, <code>transparentToStandard</code>,
				<code>transparentToMuted</code>,
				<code>standardToTransparent</code>, <code>standardToMuted</code>,
				<code>mutedToTransparent</code>
				and <code>mutedToStandard</code>. Size is <code>standard</code> (default, the padded grid
				width) or <code>full</code> (viewport-width background with the same content grid).
				Gradients run from top to bottom and require effective <code>full</code> size. Detail pages
				constrain every background to <code>standard</code>. A gradient that is not effectively full
				becomes its end color and emits a development diagnostic once per offending
				configuration/context.
			</p>
			<p>
				Detached, adjacent opaque standard-width sections share outer panel-radius corners on wide
				layouts; transparent and full-width sections break the group. Different standard/muted
				colors do not break it. The 3XL detail ContentPane owns its outer corners instead of
				rounding its individual sections.
			</p>
			<p>
				Legacy <code>section.style</code> still accepts tint, tintOpacity, backdropBlur, textColor and
				CSS width. Keep explicit legacy material settings when migrating a custom surface; do not add
				a new background role on top of them and expect both material systems to apply. Prefer the new
				grid/container contract to independent section widths, and retain textColor only as an orthogonal
				text override.
			</p>
			<h3>Content grid and cards</h3>
			<p>
				Grid classification uses the content container width before section padding, capped at
				1536px. It is independent of viewport classification. Section owns one outer padding on each
				side; ContentGrid uses the same token for its inter-block gap.
			</p>
			<table>
				<thead>
					<tr>
						<th>Container width</th>
						<th>Grid</th>
						<th>Columns</th>
						<th>Padding/gap</th>
						<th>Headline size/line height</th>
						<th>Body size/line height</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Below 600px</td>
						<td>xs</td>
						<td>4</td>
						<td>12px</td>
						<td>18px/28px</td>
						<td>14px/20px</td>
					</tr>
					<tr>
						<td>600px to below 840px</td>
						<td>s</td>
						<td>6</td>
						<td>16px</td>
						<td>18px/28px</td>
						<td>14px/20px</td>
					</tr>
					<tr>
						<td>840px to below 1200px</td>
						<td>m</td>
						<td>8</td>
						<td>16px</td>
						<td>20px/32px</td>
						<td>14px/20px</td>
					</tr>
					<tr>
						<td>1200px to 1536px</td>
						<td>l</td>
						<td>12</td>
						<td>24px</td>
						<td>24px/40px</td>
						<td>16px/24px</td>
					</tr>
				</tbody>
			</table>
			<p>
				ContentBlock span values are positive integers. A single number applies at every grid size.
				Responsive values inherit the last supplied smaller size; before the first supplied value
				they fill the row. Invalid values fall back to the full row and excessive spans clamp to
				available columns, with development diagnostics. Placement follows DOM order without dense
				backfilling. Ordinary Section children remain ordinary content unless wrapped in
				ContentGrid/ContentBlock.
			</p>
			<p>
				Cards use Page Sections 0.4.1. The media frame has its own configurable aspect ratio; the
				text area adds independent height. All cards in a collection have equal heights across rows.
			</p>
			<ul>
				<li>S: 2 columns, 12px title, two title lines, no eyebrow.</li>
				<li>M: 2 columns, 14px title, two title lines.</li>
				<li>L: 4 columns (3 in grid S), 18px title, three title lines.</li>
				<li>
					M/L reserve an additional eyebrow row for every item when any item has a nonblank eyebrow.
				</li>
				<li>Text padding is 12px; contained media has an 8px inset.</li>
			</ul>
			<p>
				Use these options directly on <code>SpatialCardGridSection</code> (not inside
				<code>section</code>): <code>cardSize=&quot;s|m|l&quot;</code>,
				<code>cardTone=&quot;standard|muted&quot;</code>,
				<code>textAlign=&quot;start|center&quot;</code>,
				<code>mediaAspect=&quot;1/1|3/2|4/3&quot;</code>
				and <code>mediaFit=&quot;contain|cover&quot;</code>. <code>SpatialListPage</code> forwards
				all of them. <code>cardVariant=&quot;catalog&quot;</code> (default) uses responsive
				size-based spans; <code>cardVariant=&quot;editorial&quot;</code> uses <code>itemSpan</code>
				(default <code>&#123; xs: 4, s: 3, m: 4, l: 4 &#125;</code>) and a title link. Spatial media
				defaults to <code>1/1</code>; Page Sections defaults to <code>3/2</code>. Keep
				<code>itemKey</code> stable for repeated items and reordering.
			</p>
			<p>
				See <a href="/docs/foundations/page-shell/">Page shell and navigation</a> for composition and
				route conventions.
			</p>
			<p>
				getSpatialListItems(elements, basePath) derives links and includes summary and flat assets
				automatically. List entries can customize summary.sectionLink to point at an authored detail
				section; this optional link sits below the carousel surface and does not change the shared
				property panel's content or height. Use itemKey to distinguish repeated copies of the same
				element within one section; internal pose/occurrence fields are assigned by the adapter.
				findSpatialElement(elements, id) returns the matching document or undefined; the host
				decides how to render a 404.
			</p>
			<p>
				Keep ordinary anchor links and supply all required data through route load functions.
				Current transition route patterns and deployment requirements are documented in <a
					href="/docs/foundations/first-experience/">Getting started</a
				>.
			</p>
			<p>
				<code>SpatialListItem.targetPresentation: 'dock'</code> and
				<code>summary.sectionLink.targetPresentation: 'dock'</code>
				declare that a fragment destination opens the completely docked content view. This optional contract
				allows its endpoint to be resolved before route mounting; arbitrary fragments still use the ordinary
				restored-destination path. Native document limits remain authoritative. In 3XL the model stays
				on the fixed left stage and the pane header is the corresponding endpoint. See
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/design/layout/staged-detail-endpoints.md"
					>known detail endpoints</a
				>.
			</p>
			<p>
				The source-first transition currently requires <code>?stagedNavigation=1</code> on the source
				page and an enhanced, prepared source. It remains an experimental opt-in until the production
				performance gate is accepted. The declaration does not enable that path by itself. Without the
				query opt-in, the ordinary transition remains active; no application link or history migration
				is required.
			</p>
			<p>
				<code>getSpatialListItems</code> also preserves each element's <code>minimap</code> settings
				so a compact destination uses the same fit, pivot and docked orientation as its mounted
				detail. Custom synchronous shell summaries receive <code>SpatialSummaryContext</code>.
				Initialize <code>createCatalogEndpointAction()</code> inside the custom summary component
				and apply <code>context.address('title')</code> / <code>context.address('eyebrow')</code>
				to its actual text nodes. The factory depends on the enclosing Stage context and cannot be initialized
				by a parent above BrandStageShell. See the complete
				<a href="/docs/sections/summaries/">live summary example</a>.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'renderer-infrastructure',
			title: 'Renderer infrastructure',
			headline: 'Renderer infrastructure',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				BrandStageShell.renderSettings accepts maxPixelRatio (default 1) and maxPixels (default
				2,073,600). The tighter budget wins. maxPixels: null disables the area limit;
				invalid/nonpositive numeric values fall back to defaults. DOM text retains native
				resolution. Budget settings are applied at renderer creation and page binding; they are not
				an animation control. See <a href="/docs/advanced/performance/">performance</a>.
			</p>
			<p>
				BrandStageShell.dracoDecoderPath is the directory of host-served Draco decoder files, with
				trailing slash. Default: /assets/draco/gltf/. Models and decoders are not application static
				assets installed automatically by the package. Meshopt uses the Three.js decoder dependency.
			</p>
			<p>
				Stage, Panel, StageViewport and StageExperience are lower-level building blocks for custom
				integrations. Stage's low-level standalone glb/hdr/model/background/camera options configure
				a manually composed scene; they do not need to be repeated when using BrandStageShell and
				page components. Manual Stage.catalog / CatalogPage is retained as a legacy adapter
				contract. New SvelteKit consumers should use page registration through the high-level
				components. Internal SpatialElementScene is a renderer projection, not a third authoring
				document.
			</p>
		</div></Section
	>
</WebsitePage>
