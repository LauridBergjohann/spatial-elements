<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Detail pages' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Detail pages',
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
				<code>SpatialElementPage</code> combines one media fit, a media rail, a natural-height summary
				and ordinary sections. The same layout resolver supplies CSS and the renderer. A model is fitted
				using its full 3D bounds, including depth; projecting a near corner must not push it outside the
				allocated fit rectangle.
			</p>
			<p>
				The detail fit rectangle is a containment boundary. <code>camera.fitPadding</code> reserves
				space inside it, and <code>camera.fitScale</code> can reduce that padding when enlarging an
				element. Enlargement stops at the rectangle's edges; older magnification values cannot move
				the resting geometry under the media rail or summary. A smaller <code>fitScale</code> still leaves
				more space around the model. Interactive zoom deliberately leaves this resting fit while the surrounding
				interface clears away.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'flow-layouts-xs-through-2xl',
			title: 'Flow layouts: XS through 2XL',
			headline: 'Flow layouts: XS through 2XL',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				XS and S place the media rail horizontally below the model, followed by the summary. M and
				wider place a vertical rail at the left and the summary beside the model. Content follows
				the hero; the section submenu appears from M. Natural panel height is bounded by the hero
				where appropriate, with local summary overflow rather than arbitrary global height
				assumptions.
			</p>
			<table>
				<thead>
					<tr>
						<th>Layout</th>
						<th>Media-fit height rule</th>
						<th>Rail item</th>
						<th>Summary</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>XS</td>
						<td>clamp(viewport height − 214, 150, 400)</td>
						<td>80</td>
						<td>Full available width minus 8px per side, below media</td>
					</tr>
					<tr>
						<td>S</td>
						<td>clamp(viewport height − 214, 150, 500)</td>
						<td>80</td>
						<td>Full available width minus 8px per side, below media</td>
					</tr>
					<tr>
						<td>M</td>
						<td>clamp(viewport height − 180, 300, 500)</td>
						<td>80</td>
						<td>Three grid columns</td>
					</tr>
					<tr>
						<td>L</td>
						<td>clamp(viewport height − 194, 340, 600)</td>
						<td>80</td>
						<td>Four grid columns</td>
					</tr>
					<tr>
						<td>XL</td>
						<td>clamp(viewport height − 236, 400, 700)</td>
						<td>112</td>
						<td>Four grid columns</td>
					</tr>
					<tr>
						<td>2XL</td>
						<td>clamp(viewport height − 216, 400, 800)</td>
						<td>Up to 138, constrained to the available left space</td>
						<td>Four grid columns</td>
					</tr>
					<tr>
						<td>3XL</td>
						<td>Usable height − 112</td>
						<td>138</td>
						<td>Inside the right pane</td>
					</tr>
				</tbody>
			</table>
			<p>
				Safe areas and the usable viewport are applied before resolving these rectangles. The 2XL
				rail also respects its 7% viewport-width limit and minimum outside inset. The media itself
				preserves aspect ratio; these heights describe the allocation, not a stretched model or
				image.
			</p>
			<p>
				Vertical swipes over the rail and properties panel can continue scrolling the document. The
				horizontal rail confines its horizontal scroll direction; a summary with overflowing content
				scrolls locally until its edge, then passes the gesture to the page. Breadcrumbs use the
				centered content width in flow layouts and the pane width in 3XL. Detail and fullscreen
				controls use the dedicated box icons from the layout design.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'seven-sizes-in-the-public-demo',
			title: 'Seven sizes in the public demo',
			headline: 'Seven sizes in the public demo',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				These are individual WebGPU screenshots of <code>/demo/elements/column</code>, all at 900
				CSS pixels high. They show the same content and resting camera, with no private brand
				assets. The viewport capture intentionally stops at the browser edge; content below it
				remains reachable by ordinary document scrolling.
			</p>
			<h3>XS: 375px wide</h3>
			<p><img src="/documentation/images/detail-xs.png" alt="" loading="lazy" /></p>
			<p>
				<em>The compact menu remains usable, and the summary fills the available reading width.</em>
			</p>
			<h3>S: 720px wide</h3>
			<p><img src="/documentation/images/detail-s.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The summary continues below the viewport; its height is not compressed to fit one screen.</em
				>
			</p>
			<h3>M: 1024px wide</h3>
			<p><img src="/documentation/images/detail-m.png" alt="" loading="lazy" /></p>
			<p><em>The composition changes at M. Content still follows the hero in document flow.</em></p>
			<h3>L: 1440px wide</h3>
			<p><img src="/documentation/images/detail-l.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The summary uses four grid columns, with the controls immediately beside its upper edge.</em
				>
			</p>
			<h3>XL: 1700px wide</h3>
			<p><img src="/documentation/images/detail-xl.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The menu gains its top inset and satellite slots. Detached content sections use the
					capped centered container.</em
				>
			</p>
			<h3>2XL: 2000px wide</h3>
			<p><img src="/documentation/images/detail-2xl.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The detail composition is still in flow; widening the viewport does not stretch ordinary
					content beyond its cap.</em
				>
			</p>
			<h3>3XL: 2456px wide</h3>
			<p><img src="/documentation/images/detail-3xl.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The pane owns its header and bottom section navigation. Its live content scrolls with the
					document.</em
				>
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'docking-while-reading',
			title: 'Docking while reading',
			headline: 'Docking while reading',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Scrolling a flow detail page brings a compact header into view and moves the existing
				minimap into it. The header is 76px at XS/S, 80px at M and 86px from L. The section submenu
				is absent at XS/S, 40px at M and 44px from L.
			</p>
			<p>
				The docked model's projected upper edge aligns with the viewport's safe top edge. Its fit
				square may extend above the header, but its geometry does not get clipped there. Hover
				enlargement and device rotation recompute this alignment from the live 3D pose; the model
				grows downward. If enlargement reaches beyond the safe left edge, only the necessary
				horizontal correction is applied, without reducing the model or its hover motion. The
				correction blends into the normal scroll morph, and the prepared navigation endpoint uses
				the same geometry.
			</p>
			<p>
				There is exactly one live section-navigation element. Its ownership moves from the source
				panel into the dock; it is not duplicated into separately focusable desktop/mobile versions.
				Link identity, horizontal scroll and keyboard focus survive the move. Returning restores it
				to the source position. When route teardown has already detached that source, the controller
				uses an ordinary DOM move rather than an invalid state-preserving atomic move.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'zoom-and-fullscreen',
			title: 'Zoom and fullscreen',
			headline: 'Zoom and fullscreen',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Zoom expands the media interaction area and removes page chrome from interaction. The detail
				button returns to the fitted pose. Fullscreen uses the browser API when available and a
				viewport presentation otherwise; Escape returns without discarding the page's scroll
				position.
			</p>
			<p>
				The minimap is bottom-left at XS/S and top-left from M. Tools remain upper-right. Insets and
				minimap sizes are layout-owned, so they must not be hard-coded by host CSS. Reduced motion
				changes animation behavior without removing accessible controls.
			</p>
			<p>
				The <a href="/docs/advanced/reading-pane/">ultra-wide composition</a> uses a fixed media
				region and a document-scrolling pane instead of the flow dock.
				<a href="/docs/interaction/media/">Media and Interaction</a> describes image/video behavior in
				the same fit.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'why-heights-are-bounded-not-universally-fixed',
			title: 'Why heights are bounded, not universally fixed',
			headline: 'Why heights are bounded, not universally fixed',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				A shared width and known media rectangle make navigation predictable. Text can still be
				longer, translated or authored with a custom snippet. Preserving natural summary height
				avoids clipping content merely to force all pages into an identical bitmap. Test both short
				and long summaries at every composition boundary.
			</p>
		</div></Section
	>
</WebsitePage>
