<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'powershell',
			code: "$env:PROFILE_WIDTH='1098'\n$env:PROFILE_HEIGHT='831'\n$env:PROFILE_DPR='2'\nnpm.cmd run profile:demo -- my-surface\n"
		},
		{
			language: 'svelte',
			code: '\u003cBrandStageShell {theme}\n  renderSettings={{ maxPixelRatio: 1, maxPixels: 2_073_600 }}>\n  {@render children()}\n\u003c/BrandStageShell>\n'
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Performance' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Performance',
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
				Analysis date: 2026-10-01. Baseline: commit <code>2f1196f</code>, including the five
				procedural demo geometries.
			</p>
			<p>
				The later layout redesign uses a different source-only navigation path. Its separate
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/design/layout/staged-performance.md"
					>production measurement protocol</a
				> describes cold/warm route validation and exact movement/holding boundaries. The historical numbers
				below are not measurements of that new path.
			</p>
			<p>
				The demo's main costs are repeated full-screen rendering, preparation of render targets and
				shaders, and DOM style/layout work. Geometry simplification is not the appropriate first
				fix. The package now limits WebGPU resolution independently of HTML resolution, bounds
				temporary captures, avoids redundant submissions and layout reads, and prepares effects
				before interaction. Cold navigation still needs separate attention; a smooth steady
				interaction does not establish that the first navigation is free of long frames.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'measurement-conditions',
			title: 'Measurement conditions',
			headline: 'Measurement conditions',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The reported machine is a Surface Book with an i7-1065G7 and GTX 1650, a 3000 by 2000
				display, 200% zoom and an approximately 1098 by 831 CSS-pixel browser viewport. Measurements
				use the local production demo, installed headless Chrome 154, that CSS viewport, and device
				scale factor 2. The final run records the renderer's actual <code>requestAdapter</code>
				call: <strong>Intel Gen11</strong>, using WebGPU compatibility mode. Independent default and
				high-performance adapter requests also select Intel. These measurements do not establish GTX
				1650 performance or the adapter used by an already-open Chrome window under a different
				Windows/browser profile.
			</p>
			<p>
				The profiler records real browser animation-frame intervals, long tasks, Chrome main-thread
				metrics, navigation timestamps, output sizes and render-target inventory. Scroll and zoom
				use actual mouse-wheel input. Synthetic <code>stage-test</code> frame advancement is
				reserved for functional tests and is not used for performance measurements. The final
				profiler verifies scrolling, model enlargement and a close-up focus above 0.8, and separates
				navigation preparation from the
				<code>animating</code> phase.
			</p>
			<p>
				Frame percentiles cover the interaction and a short settling tail. They are <strong
					>not GPU timings</strong
				>
				or an average of continuously rendered FPS. Idle frames can lower the median. Cold compilation,
				browser scheduling, thermal state and other applications introduce variation; results are single-run
				diagnostics, not a statistically controlled benchmark. Main-thread <code>TaskDuration</code>
				already includes script, style and layout time: these values must not be added together.
			</p>
			<p>
				Local raw captures are kept in <code>.artifacts/performance/</code> (ignored by Git). The baseline
				and intermediate captures remain available alongside the final result. Earlier runs did not include
				phase/gesture validation; the later matching wheel sequence confirms the mild zoom enlarges the
				model by approximately 22% without entering the close-up UI. Full close-up is measured separately.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'measured-results',
			title: 'Measured results',
			headline: 'Measured results',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The final run keeps native DPR 2 and uses the new <strong>render</strong> ratio 1. It includes
				all listed optimizations and prewarming on detail binding. Values below are browser RAF intervals
				in ms.
			</p>
			<table>
				<thead>
					<tr>
						<th>Scenario</th>
						<th>Baseline median / p95</th>
						<th>Final median / p95</th>
						<th>Final maximum</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>List to detail, including preparation</td>
						<td>16.7 / 183.0</td>
						<td>16.7 / 33.4</td>
						<td>816.8</td>
					</tr>
					<tr>
						<td>Carousel to detail, including preparation</td>
						<td>16.7 / 116.7</td>
						<td>16.7 / 33.5</td>
						<td>533.5</td>
					</tr>
					<tr>
						<td>Scroll after list navigation</td>
						<td>16.7 / 50.1</td>
						<td>16.7 / 33.3</td>
						<td>100.1</td>
					</tr>
					<tr>
						<td>Scroll after carousel navigation</td>
						<td>16.7 / 66.7</td>
						<td>16.7 / 18.0</td>
						<td>66.6</td>
					</tr>
					<tr>
						<td>Mild zoom after list navigation</td>
						<td>33.5 / 50.2</td>
						<td>16.7 / 16.8</td>
						<td>18.3</td>
					</tr>
					<tr>
						<td>Mild zoom after carousel navigation</td>
						<td>50.0 / 66.8</td>
						<td>16.7 / 16.8</td>
						<td>33.2</td>
					</tr>
					<tr>
						<td>Full close-up after list navigation</td>
						<td>Not captured</td>
						<td>16.7 / 33.3</td>
						<td>150.0</td>
					</tr>
					<tr>
						<td>Full close-up after carousel navigation</td>
						<td>Not captured</td>
						<td>16.7 / 19.9</td>
						<td>66.7</td>
					</tr>
				</tbody>
			</table>
			<p>
				Sources: <code>baseline-surface.json</code> and <code>final-surface.json</code>. The final
				sampler additionally starts at an RAF boundary, records phases/gesture extrema and drains
				pending long-task entries. Do not treat small differences or maximum-frame improvements as a
				controlled statistical comparison. Actual full close-up reaches focus 0.935 in both final
				scenarios; scroll travel is 1170 CSS pixels.
			</p>
			<p>
				The final moving transition phase has median 16.7 ms in both views, p95 33.4 ms for list and
				49.9 ms for carousel, with maxima 100.0 and 83.3 ms respectively. The largest 816.8/533.5 ms
				frames occur in the <strong>captured/preparing</strong> phase. The baseline list maximum was
				650.1 ms:
				<strong>prewarming has not improved cold navigation latency</strong>, and can move more work
				before motion. The package is substantially better at sustained interaction, but these
				results do not justify a claim of uninterrupted 60 FPS or hitch-free cold navigation.
			</p>
			<p>
				On the main thread, the list scroll scenario fell from about 1773 to 1046 ms total task
				time, and style recalculation from 187 to 75 ms. The carousel scroll scenario fell from
				about 1557 to 1018 ms, with style recalculation from 140 to 80 ms. These totals cover the
				whole gesture and settling period, not individual frame times.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'findings-and-implemented-changes',
			title: 'Findings and implemented changes',
			headline: 'Findings and implemented changes',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<table>
				<thead>
					<tr>
						<th>Area</th>
						<th>Evidence and change</th>
						<th>Scope and tradeoff</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Output resolution</td>
						<td
							>The old cap was DPR 2 with no pixel-area budget. At 1098 by 831, that is 3,649,752
							pixels per full-size image. The default is now DPR 1, or 912,438 pixels: 75% fewer
							pixels per such pass.</td
						>
						<td
							>Configurable on <code>Stage</code>, <code>BrandStageShell</code> and
							<code>StageExperience</code>. HTML text remains at native resolution. 3D edges are
							less densely sampled on high-DPI screens.</td
						>
					</tr>
					<tr>
						<td>Temporary catalog fades</td>
						<td
							>A prepared approximately 524k-pixel capture grew to full drawing-buffer size on the
							first moving frame. The fade now retains the same 524,288-pixel budget as Low/High
							refinement.</td
						>
						<td
							>Prevents a large allocation during motion. Temporary fades are less detailed; settled
							geometry follows the configured stage resolution.</td
						>
					</tr>
					<tr>
						<td>Empty catalog submissions</td>
						<td
							>Empty rear/front scenes and an empty unclipped carousel scene were still submitted.
							Three's canvas render path also applies a full-screen output conversion for each such
							submission.</td
						>
						<td>Empty bands now skip rendering while retained handoff geometry remains visible.</td>
					</tr>
					<tr>
						<td>Backdrop resolve</td>
						<td
							>A Gaussian image calculated at half CSS density was copied back to full output
							density.</td
						>
						<td
							>Resolve textures now retain the Gaussian density and normalized UV mapping. At old
							DPR 2, this removes 15 of every 16 resolved pixels for blur values of at least 4.
							Zero-blur textures retain sharp resolution.</td
						>
					</tr>
					<tr>
						<td>Minimap DOM projection</td>
						<td
							>CPU sampling attributed about 346.5 ms to <code>offsetLeft</code> in
							<code>renderFlatMinimapSurface</code> during one baseline navigation. It followed style/CSS3D
							writes and forced synchronization.</td
						>
						<td
							>Projected surfaces explicitly own a zero-margin origin; the transform now uses that
							origin without reading DOM offsets. Corner-projection tests cover rest, tilt and
							resize.</td
						>
					</tr>
					<tr>
						<td>Carousel layout</td>
						<td
							>Every actor wrote hit-target styles before reading the next summary's <code
								>offsetWidth</code
							>/<code>offsetHeight</code>.</td
						>
						<td
							>Summary dimensions are cached in the measurement phase and invalidated by <code
								>ResizeObserver</code
							>, including changes to summary content.</td
						>
					</tr>
					<tr>
						<td>Scroll styles</td>
						<td
							>Every virtual-scroll frame changed an inherited custom property on the whole document
							subtree, with only one docked-minimap consumer.</td
						>
						<td
							>Only the docked minimap now receives its compensated position. Fractional/reverse
							scroll, desktop/compact docking and teardown are tested.</td
						>
					</tr>
					<tr>
						<td>Zoom clock</td>
						<td
							>Wheel and SpaceMouse events overwrote the timestamp used to calculate the next
							rendered-frame delta. Input immediately before RAF shortened damping time.</td
						>
						<td
							>Only rendering advances the frame clock. Burst-input tests exercise the actual
							stage/input wiring.</td
						>
					</tr>
					<tr>
						<td>Transition DOM snapshots</td>
						<td
							>Appending/hiding one snapshot before measuring the next repeatedly dirtied connected
							DOM.</td
						>
						<td
							>Outgoing and incoming clones are collected while detached and appended after
							measurement. Complete computed styles and cleanup behavior are retained. Unchanged
							transition opacity values are not rewritten.</td
						>
					</tr>
					<tr>
						<td>Minimap ring</td>
						<td
							>Identical viewport geometry rebuilt contour vectors, bounds and GPU buffers on every
							update.</td
						>
						<td
							>Exact input caching skips unchanged updates; changed radii/dimensions still
							invalidate it.</td
						>
					</tr>
					<tr>
						<td>First interaction after navigation</td>
						<td
							>Initial stage creation warmed both quality target sets, but page rebinding did not.
							Hidden frosted minimap blur therefore remained cold until zoom.</td
						>
						<td
							>Rebinding now warms full and scroll sets before motion, followed by existing zoom
							preparation and GPU completion synchronization. This deliberately spends work during
							binding instead of the first gesture.</td
						>
					</tr>
				</tbody>
			</table>
			<p>Relevant implementation entry points:</p>
			<ul>
				<li>
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/renderSettings.ts"
						>Render resolution policy</a
					>
					and
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/StageRenderPipeline.ts"
						>render pipeline</a
					>.
				</li>
				<li>
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/CatalogSpatialElementLayer.ts"
						>Catalog rendering and measurement</a
					>,
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/CatalogGeometryFade.ts"
						>fade capture</a
					>, and
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/CatalogTransition.ts"
						>transition snapshots</a
					>.
				</li>
				<li>
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/StageExperience.ts"
						>Frame lifecycle</a
					>,
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/PanelPresentationController.ts"
						>DOM projection</a
					>, and
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/VirtualScrollController.ts"
						>virtual scrolling</a
					>.
				</li>
				<li>
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/spatial-element/SpatialElementDockController.ts"
						>Dock positioning</a
					>
					and
					<a
						href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/stage/minimap/MinimapGeometry.ts"
						>minimap geometry</a
					>.
				</li>
			</ul>
		</div></Section
	>
	<Section
		section={{
			id: 'repository-areas-examined',
			title: 'Repository areas examined',
			headline: 'Repository areas examined',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The review covered core stage scheduling, interaction/picking, render/output bands, blur and
				outline passes, panel geometry and projection, minimap rendering, virtual scroll/docking,
				catalog composition and transitions, asset preparation/caching, and Svelte
				lifecycle/navigation and scrollspy behavior. The asset generator and production demo were
				checked against these paths.
			</p>
			<p>
				All five low-detail demo models together contain only <strong>1,692 triangles</strong>. The
				largest high-detail model contains <strong>9,216 triangles</strong>, its GLB is
				approximately 227 KB, and the HDR is approximately 131 KB. Each model has one mesh. This is
				consistent with the observation that lowering output resolution materially improves
				interaction while changing no geometry.
			</p>
			<p>
				Asset loading already deduplicates resources, separates instance/lease lifetimes, bounds
				idle cache entries and bytes, and limits concurrent visible-preview requests. Rendering is
				already invalidated on demand rather than using an unconditional permanent frame loop. These
				mechanisms were preserved. More aggressive mesh compression, a new worker pipeline, or
				replacing the framework are not supported as priorities by the measurements collected here.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'remaining-priorities',
			title: 'Remaining priorities',
			headline: 'Remaining priorities',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<ol>
				<li>
					<strong>Cold navigation and shader variants.</strong> Preparation still causes a visible delay
					before motion, and some animation frames remain above the 16.7 ms target. Separate route binding,
					computed-style cloning, GPU allocation and shader compilation in a full Chrome trace before
					changing readiness ownership. Warm-up must match the actual render variants: the prepared High
					scene has no fog while the moving handoff scene may have fog. A new variant is a source-derived
					hypothesis, not a measured attribution for every spike.
				</li>
				<li>
					<strong>Output-band composition.</strong> Three r185 allocates an internal HalfFloat/MSAA framebuffer
					per canvas and applies output conversion per canvas scene submission. The background path copies
					its capture through this additional framebuffer. Consolidating each band into one linear composition/output
					pass could reduce bandwidth further, but requires alpha, tone-mapping, glass and backdrop visual
					regression checks. The existing target inventory does not include these private Three framebuffers
					and is not a complete VRAM meter.
				</li>
				<li>
					<strong>Inherited transition styles and scrollspy.</strong> Changing transition opacity still
					invalidates descendants. The detail scrollspy reads computed styles and section bounds after
					virtual scroll/dock changes. Cache section offsets with explicit content/resize/restoration
					invalidation, or introduce a coordinated read-before-write phase if profiling identifies these
					as the next dominant CPU cost.
				</li>
				<li>
					<strong>Glass-specific cost.</strong> A glass minimap uses a full-viewport panel capture. Cropping
					needs matching camera and shader UV changes. Resizing a glass panel also updates an indexed
					128 by 82 grid and recreates edge/shadow geometry. The demo's frosted surfaces avoid most of
					this work, so demo results cannot be generalized to all glass-heavy applications.
				</li>
				<li>
					<strong>Picking and smaller allocations.</strong> Raw pointer/wheel events synchronously perform
					DOM occlusion queries and raycasting. Hover picking could be coalesced to RAF; wheel ownership
					must remain synchronous so page scrolling is not incorrectly consumed. Smaller per-frame allocations
					remain, but should follow the larger measured costs in priority.
				</li>
			</ol>
			<p>
				The renderer cannot force Windows/Chrome to choose the discrete GPU. Hardware selection
				should be recorded for every comparison instead of assuming that a laptop's installed GTX is
				active.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'reproduce-and-tune',
			title: 'Reproduce and tune',
			headline: 'Reproduce and tune',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>Run from the repository root in PowerShell:</p>

			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				This builds the packages and production demo, starts an isolated preview server on port
				4175, profiles list/carousel navigation, scrolling, mild zoom and close-up, then writes
				<code>.artifacts/performance/my-surface.json</code>. <code>PROFILE_PORT</code> changes the
				port; the server is closed after the run. <code>PROFILE_CPU='list-to-detail'</code>
				additionally writes a Chrome <code>.cpuprofile</code> for that scenario.
				<code>PROFILE_CLOSEUP='0'</code> omits the extra close-up scenarios. Run without other builds
				or benchmarks in parallel. Close-up and mild-zoom validation failures stop the run instead of
				silently labelling a missed input as a successful measurement.
			</p>
			<p>The new default is equivalent to:</p>

			<CodeBlock
				code={examples[1].code}
				language={examples[1].language}
				highlighted={data.highlights[1]}
			/>
			<p>
				Use <code>maxPixelRatio: 1.5</code> for denser 3D output. The previous resolution policy can
				be restored with
				<code>&#123; maxPixelRatio: 2, maxPixels: null &#125;</code>. On very large CSS viewports
				the area budget can lower the render ratio below 1. These are stage-wide rasterization
				settings; they do not resize HTML, change model LODs or alter the user's browser zoom.
			</p>
			<p>
				Functional validation includes frame-clock burst input, docking restoration, projection
				math, bounded/reused fade targets, skipped submissions, summary resize invalidation,
				snapshot read/write ordering, backdrop density and unchanged ring buffers. Browser tests
				cover all three catalog views, history/anchors, no-JS/no-GPU fallback, output budget,
				prepared scroll targets, close-up and scrolling. Browser screenshots check the rendered
				close-up and docked layout; functional tests deliberately do not impose unstable
				machine-dependent FPS thresholds.
			</p>
		</div></Section
	>
</WebsitePage>
