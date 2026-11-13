<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { ContentPage, Section, SpatialCardGridSection, SpatialCarouselSection } from '@spatial-elements/sveltekit';\n  let { data } = $props();\n\u003c/script>\n\u003cContentPage hdr=\"/assets/category.hdr\" page={{ title: 'Collection', breadcrumbs: [{ label: 'Elements' }] }}>\n  \u003cSection section={{ id: 'introduction', title: 'Discover the collection', headline: 'Discover the collection', background: { color: 'standard' } }}>\n    \u003cp>Your own text, images and links.\u003c/p>\n  \u003c/Section>\n  \u003cSpatialCardGridSection section={{ id: 'elements', title: 'Elements', headline: 'Elements' }} list={data.spatialElements} />\n  \u003cSpatialCarouselSection section={{ id: 'featured', title: 'Featured', headline: 'Featured' }} list={data.spatialElements} />\n\u003c/ContentPage>\n"
		},
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { Section, ContentGrid, ContentBlock } from '@spatial-elements/sveltekit';\n\u003c/script>\n\n\u003cSection section={{\n  id: 'materials', title: 'Materials', headline: 'Built for everyday use',\n  background: { color: 'muted' }\n}}>\n  \u003cContentGrid>\n    \u003cContentBlock span={{ xs: 4, s: 6, m: 4 }}>\n      \u003cp>Material and finish information.\u003c/p>\n    \u003c/ContentBlock>\n    \u003cContentBlock span={{ xs: 4, s: 6, m: 4, l: 8 }}>\n      \u003cp>Care instructions and other independently authored content.\u003c/p>\n    \u003c/ContentBlock>\n  \u003c/ContentGrid>\n\u003c/Section>\n"
		},
		{
			language: 'svelte',
			code: '\u003cBrandStageShell {theme}>\n  {#snippet summary(context)}\n    \u003cProductConfiguration {context} />\n  {/snippet}\n  {@render children()}\n\u003c/BrandStageShell>\n'
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Composing spatial content' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Composing spatial content',
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
				Start with the executable <a href="/docs/foundations/first-experience/"
					>getting-started guide</a
				>
				and the <a href="/docs/reference/api/">API reference</a>.
			</p>
			<p>
				Use a persistent brand layout with BrandStageShell and a SpatialTheme. Create a theme with
				createSpatialTheme(&#123; id, name &#125;) and optional appearance overrides. Define
				geometry: &#123; low, high &#125;, detail hdr and other model settings directly on
				SpatialElementData. ContentPage and SpatialElementPage register their own data;
				SpatialCardGridSection and SpatialCarouselSection register their own occurrences. Layouts do
				not need stage or catalog props. Asset identity remains element identity.
			</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				On a detail route use SpatialElementPage with a SpatialElementData document and Section
				children. Resolve required content in the route load function before navigation completes.
				Optional models and backgrounds are prepared separately. Keep ordinary anchors for history,
				keyboard and no-JS behavior. Current navigation recipes use <code
					>/brand/categories/&#123;list,carousel,mixed&#125;</code
				>
				and
				<code>/brand/elements/id</code> routes. The host-specific <code>/brand/products/id</code> spelling
				also remains supported; arbitrary route structures are not yet configurable. The demo uses /demo/...
				.
			</p>
			<p>
				Set category lighting explicitly through ContentPage.hdr (also required by SpatialListPage).
				No HDR is inferred from list contents.
			</p>
			<p>
				Declare low/high LODs in one common coordinate frame; a verified physical frame needs
				independently validated dimensions. The generated demo uses provisional shared frames.
				Provide accessible posters for fallback rendering. No default element model or third-party
				environment is bundled. Supply a Draco decoder directory with the BrandStageShell
				dracoDecoderPath prop (trailing slash, base-path aware) when using Draco; the compatibility
				default is /assets/draco/gltf/. Meshopt uses the Three.js decoder dependency.
			</p>
			<p>
				Asset URLs, base-path resolution, content fetching and deployment are application
				responsibilities. Inspect apps/tests/src/lib/catalog.ts and its routes for a complete
				working example.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'layout-headings-and-section-backgrounds',
			title: 'Layout, headings and section backgrounds',
			headline: 'Layout, headings and section backgrounds',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Keep <code>section.title</code> as the short navigation and accessibility label. Set
				<code>section.headline</code>
				when the section should display a heading; omitting it leaves no heading or reserved heading gap.
				The section anchor and generated navigation use <code>id</code> and <code>title</code>. The
				section's anchor and generated detail navigation continue to use
				<code>id</code>
				and <code>title</code>.
			</p>
			<p>
				Sections are transparent by default. Choose <code
					>background: &#123; color: 'standard' &#125;</code
				>
				or
				<code>&#123; color: 'muted' &#125;</code> for a solid section surface. The theme supplies
				those two colors through
				<code>sectionBackgrounds</code>. On ContentPages, <code>size: 'full'</code> extends only the
				background to the viewport edges; text and cards keep the same grid. A gradient such as
				<code>&#123; color: 'transparentToMuted', size: 'full' &#125;</code> runs from top to bottom.
				Gradients require an effective full-width background. Detail sections always use standard width,
				so an invalid gradient becomes its end color and produces a development diagnostic.
			</p>
			<p>
				Use <code>ContentGrid</code> and <code>ContentBlock</code> for explicit content columns.
				Section owns the outer padding; a grid adds only the gaps between blocks. Grid size follows
				the content container, not the viewport: 4 columns below 600px, 6 from 600px, 8 from 840px
				and 12 from 1200px, with a maximum container width of 1536px. Responsive spans inherit the
				last smaller size; before the first specified size, or when <code>span</code> is omitted, a block
				fills the row. DOM order remains reading and keyboard order.
			</p>

			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				Ordinary Section children still work without a grid. Do not add another fixed margin around
				every block or repeat the section padding. Grid gutters and typography change together at
				the container boundaries. Theme <code>radii.control</code> styles cards and small controls;
				<code>radii.panel</code> styles panels and detached section groups. The defaults are 12px
				and 16px. An explicitly authored legacy <code>panelShape.radius</code> remains a fallback
				for both roles. Set <code>ContentPage background=&quot;#f7f5f0&quot;</code> for a page-specific
				flat color; this updates native and enhanced backgrounds without changing the shared theme or
				HDR lighting.
			</p>
			<p>
				Cards use Page Sections 0.3.0. The media frame has its own configurable aspect ratio; the
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
				Use <code>mediaAspect=&quot;1/1&quot;</code> (spatial default), <code>&quot;3/2&quot;</code>
				or <code>&quot;4/3&quot;</code>, <code>mediaFit=&quot;contain&quot;</code> (default) or
				<code>&quot;cover&quot;</code>, and <code>cardTone=&quot;standard&quot;</code> or
				<code>&quot;muted&quot;</code>
				on SpatialCardGridSection. SpatialListPage forwards these options. Keep <code>itemKey</code> stable
				for repeated items and reordering.
			</p>
			<p>
				Carousel layout follows the same content grid as the surrounding sections. Keep its section
				headline optional; omitting it also removes the heading gap from the height budget. On XS/S,
				the carousel shows a compact title and optional eyebrow above the model. The reserved title
				strip does not change when selection moves between items with and without an eyebrow. From
				M, the full information panel has natural height and centers beside the selected model. Long
				content scrolls within that panel instead of increasing the model frame. The detail link is
				an arrow in the panel's upper-right corner and retains a complete accessible product name.
			</p>
			<p>
				To author custom detail and carousel summaries, define the snippet in the persistent brand
				layout rather than in an outgoing route:
			</p>

			<CodeBlock
				code={examples[2].code}
				language={examples[2].language}
				highlighted={data.highlights[2]}
			/>
			<p>
				<code>ProductConfiguration</code> can contain genuine reactive state and controls. Use
				<code>@container spatial-summary (...)</code> for its layout and <code>context.mode</code>
				for presentation-specific content. Reserve space for the carousel's detail arrow in the custom
				heading. Keep page-head metadata outside the snippet and load initial data before rendering. The
				framework supplies a default summary when the snippet is omitted. Compact carousel UI is framework-owned;
				the full summary remains in its keyed instance while hidden, retaining state across selection
				and resizing. Use distinct <code>itemKey</code> values for repeated occurrences of one product.
			</p>
			<p>
				Carousels use a native horizontal scroll-snap rail until WebGPU enhancement. The enhanced
				carousel has one authoritative fractional turntable phase; it never drives or follows a
				native scroll offset. PointerEvents cover mouse, touch and pen, including desktop touch
				browsers without TouchEvents. Horizontal gestures work across the section surface and over
				panel text. Touch gestures may start over links; taps retain activation and drags suppress
				their compatibility click. Native vertical page scrolling and pinch zoom remain enabled
				through touch-action: pan-y pinch-zoom. The browser owns a vertical gesture until release;
				horizontal gestures do not also scroll the page.
			</p>
			<p>
				Dragging uses 220 CSS pixels per product, independent of viewport width. Endpoints offer
				elastic resistance. Release predicts the stopping seat from pointer velocity and applies
				critical damping to its position. Foreground advance and panel reveal start immediately and
				share that trajectory. Faster flicks can cross several seats; holding still removes
				momentum. Boundaries increase damping to avoid overshoot. Slow releases and cancellations
				use a short 240ms snap. Dots, arrows and keyboard retain their normal crossfade.
				Interruptions, cancellation and history restoration use the same motion state. A stationary
				tap selects a neighbour or opens the selected model's detail.
			</p>
			<p>
				With a mouse, rendered text fragments in carousel summaries remain selectable; empty panel
				space uses grab and starts a carousel drag. Active mouse drags use grabbing across the
				section. A decorative, non-interactive cursor badge indicates horizontal travel,
				selected-model details, or detail-model rotation. It follows mouse input only and hides over
				text and ordinary controls, during page scrolling, keyboard input and catalog transitions.
				Native cursors remain visible.
			</p>
			<p>
				Horizontal wheel input works over the entire section, including panels. Where
				WheelEvent.momentum is available, its first inertial sample starts the same
				velocity-predicted damping and concurrent foreground reveal as pointer release. Subsequent
				platform inertial samples are ignored. Otherwise an adaptive 110-220ms idle window uses
				event cadence, never a low-speed threshold. This is a fallback heuristic, not a physical
				trackpad finger-up signal. Unmarked platform momentum is consumed as input; only its final
				residual velocity is projected, never the original peak again. The detection delay does not
				erase that velocity. A single sample has no measurable release speed and snaps normally.
				Wheel travel has no two-seat cap. Panels remain withdrawn during the gesture. Vertical wheel
				input and control-wheel zoom retain browser behavior. Reduced motion removes selection
				animation.
			</p>
			<p>
				Cards clamp text to the selected size's line budget. Truncated titles expose their complete
				text through a native card tooltip; full text remains available on the detail page. Mouse
				hover and keyboard focus raise card text, enlarge the model and highlight the card outline
				in the accent color. Carousel models use the detail interaction theme's silhouette glow,
				including the selected model. Hover or keyboard focus smoothly removes their defocus, and a
				native tooltip identifies the element using its complete title. Carousel indicators follow
				movement immediately, and dot selections animate across intermediate elements (except under
				reduced motion). Defocus increases with distance from the center, and summary panels soften
				as they fade.
			</p>
			<p>
				Before WebGPU is ready, carousels are native horizontal scroll-snap rails with keyboard
				scrolling, pagination links and working detail links, including without JavaScript.
				Enhancement turns pagination links into controlled buttons and adds previous/next arrows
				beside the model; arrows are hidden at their respective endpoints. The rail's scrollbar is
				hidden while native scrolling remains available. The shared layout reserves the same fit
				frame before and after enhancement. Selections made while loading are retained when
				enhancement succeeds. GPU failure keeps the native presentation available. Keep fallback
				images representative of the initial model view; posters disappear immediately when their
				GPU model is ready, avoiding a duplicate silhouette during return transitions.
			</p>
			<p>
				The enhanced carousel places elements on the front arc of a shared turntable, viewed at a
				ten-degree angle. The resting information panel stays parallel to the screen. Selection
				smoothly advances an element toward the viewer without a lateral offset; perspective
				determines its size and spacing without per-element scale compensation. Products rotate with
				their seats. A shared floor plane grounds different model sizes in the same scene.
				Directional shadows project the actual mesh triangles onto that plane, with lightly softened
				edges; neutral black silhouettes only darken the page background, without tinted floor
				patches or generic circular decals. Overlapping triangles resolve to one silhouette before
				compositing, using one bounded scratch target shared across products. Mouse proximity brings
				the approached corner toward the viewer by at most four degrees per axis, without moving its
				panel; dragging, touch and reduced-motion preferences disable this response. The floor fades
				with the catalog during detail handoff. The enhanced gesture surface follows the background
				width: section width for standard and viewport width for full. Touch and trackpad gestures
				also work over panel text and controls; links and buttons retain tap activation. Mouse
				dragging can start on geometry, blank space or panel text, while buttons and links retain
				click behavior. During mouse or touch dragging, the initial panel fades out and the initial
				foreground advance retreats with travel. Passing seats stay on the ring without revealing
				panels; reversing the gesture does not restore the withdrawn presentation. Release commits
				selection and starts foreground advance alongside settling. Automatic focus/scrollIntoView
				adjustments cannot change the selected product. Dot and keyboard navigation retain the
				normal crossfade. Depth uses defocus without fog. Defocus withdraws with the foreground
				advance during a gesture, leaving the whole ring sharp; release restores foreground focus
				with the selected product. The arc fades out before wrapping, so long catalogs never
				duplicate seats; desktop layouts show up to seven elements and phone layouts normally show
				the selected model and its two neighbours. Neighbours can overlap in depth. Geometry,
				shadows, glass, blur and hit targets are clipped to the section surface, including its
				vertical bounds. A full background extends the horizontal clipping boundary to the viewport.
				Only the arc and a small preparation margin are loaded. Posters and hit targets use the same
				visibility decision, so preparation never exposes an unselectable image. Section metrics are
				cached on resize, not measured during animation. Detail transitions capture the complete
				current model and camera transforms, including an in-progress selection.
			</p>
			<p>
				On flow-layout detail pages, a touch starting on visible model geometry rotates it, and a
				second finger on the canvas enables pinch zoom. Lifting one finger returns to rotation;
				lifting all fingers ends the gesture. A new touch outside the geometry scrolls the page
				immediately. In the 3XL split layout, the free left area controls the selected 3D model;
				hiding the pane for zoom extends that free area across the viewport. A gesture keeps its
				initial owner until release. Ordinary HTML controls retain their own touch behavior.
			</p>
			<p>
				Detail <code>media</code> supports images, native video and explicit YouTube selections
				alongside the initial 3D view. Images and video use <code>object-fit: contain</code>;
				selecting either pauses the hidden main 3D scene and its sensor motion. Native video starts
				only through its controls and stops when removed. Provide caption tracks for spoken or
				otherwise meaningful audio. With image/video selected, the free left area in 3XL scrolls the
				document. A foreign player iframe owns events inside its own document. Returning from the
				collection starts with the 3D view again. See
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/design/layout/media-and-input.md"
					>media fields, examples and input boundaries</a
				>.
			</p>
			<p>
				Panel, minimap and model hover effects require a mouse pointer. Touch and stylus contact
				clear those effects, including on devices that also have a mouse. Keyboard focus indicators
				remain available.
			</p>
			<p>
				Detail pages also provide a compact, themed help button and once-per-session interaction
				guidance. Before the first manual interaction, the model subtly follows nearby mouse
				movement and then settles; reduced motion disables this preview. Configure all help strings
				through the shell's <code>messages</code> prop. See
				<a href="/docs/interaction/help/">interface texts and help</a> for translation examples, defaults,
				placement and lifecycle behavior.
			</p>
			<p>
				Keep native scrolling enabled on the page and avoid overriding the components' <code
					>touch-action</code
				> styles or cancelling their touch events in application-level handlers.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'navigation-and-live-summaries',
			title: 'Navigation and live summaries',
			headline: 'Navigation and live summaries',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The source-first transition described here currently requires <code
					>?stagedNavigation=1</code
				> on the source page. It is an experimental opt-in pending production performance acceptance;
				ordinary transitions continue to handle navigation without that flag.
			</p>
			<p>
				Keep native links as the source of navigation. A prepared forward transition moves existing
				model and panel content before mounting the destination; its final layout comes from the
				shared resolver. Data may preload during movement. Extra content and natural summary height
				belong to the later reveal. Heavy work in application <code>load</code> functions can still compete
				for the main thread.
			</p>
			<p>
				Use <code>targetPresentation: 'dock'</code> only when a linked fragment opens the fully
				docked content view. Do not add it merely because a link contains a hash. Short documents
				keep native scroll limits, and unknown positions use the ordinary transition. See
				<a href="/docs/advanced/transitions/">Transitions</a> for examples, cancellation, fallback and
				the distinction between model movement and content readiness.
			</p>
			<p>
				To preserve application-owned state from carousel to detail, put a synchronous custom
				summary in <code>BrandStageShell.summary</code>. Keep the component inside the shell context
				and register its title and eyebrow endpoint roles. The persistent host retains the actual
				instance rather than cloning its markup. See
				<a href="/docs/sections/summaries/">Summary Panels</a> for a complete component example. The retained
				carousel and detail must use the same summary renderer. A list card uses a different renderer,
				so card-to-detail navigation does not promise to transfer arbitrary card component state into
				the detail summary.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'rendering-budget',
			title: 'Rendering budget',
			headline: 'Rendering budget',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				<code>BrandStageShell</code>, <code>Stage</code>, and the core <code>StageExperience</code>
				accept <code>renderSettings</code>. WebGPU output defaults to a maximum pixel ratio of 1 and
				a per-canvas pixel budget of 2,073,600. Large viewports can render below one physical pixel
				per CSS pixel to stay within that budget. DOM text and layout retain their native
				resolution. Opt into denser 3D output with
				<code>renderSettings=&#123;&#123; maxPixelRatio: 1.5 &#125;&#125;</code>. Use
				<code>renderSettings=&#123;&#123; maxPixelRatio: 1, maxPixels: 1_500_000 &#125;&#125;</code>
				for a lower GPU budget. To restore the previous output resolution, use
				<code>renderSettings=&#123;&#123; maxPixelRatio: 2, maxPixels: null &#125;&#125;</code>.
				These settings belong on the persistent stage; pass them at creation or when binding a new
				page. Invalid or nonpositive values use the defaults.
			</p>
		</div></Section
	>
</WebsitePage>
