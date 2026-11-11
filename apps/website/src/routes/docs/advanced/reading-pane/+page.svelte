<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Wide-screen reading pane' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Wide-screen reading pane',
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
				At 2300px and wider, with at least 512px of usable height, detail pages split into a
				stationary media area and a document-scrolling content pane. ContentPages and carousels
				retain their ordinary centered composition.
			</p>
			<p><img src="/documentation/images/detail-pane-scrolled.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The production fixture after a real section-link click. The same document scrolls; the
					pane has no independent vertical scrollbar.</em
				>
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'geometry',
			title: 'Geometry',
			headline: 'Geometry',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Let <code>W</code> be viewport width minus the classic scrollbar, before subtracting safe
				areas. The pane begins at <code>W / 2 + 8px</code>. Its width grows from the remaining
				right-hand area, keeps a 20px outside inset plus the right safe inset, and stops at 1536px.
				At that cap its left edge stays anchored to the midpoint; extra space appears on the far
				right.
			</p>
			<p><img src="/documentation/images/pane-cap.png" alt="" loading="lazy" /></p>
			<p>
				<em
					>The pane stops growing at 1536px. The additional right-hand space does not move its left
					anchor; safe areas and scrollbar widths are zero in this comparison.</em
				>
			</p>
			<table>
				<thead>
					<tr>
						<th>Region</th>
						<th>Vertical rule, before safe-area offsets</th>
					</tr>
				</thead>
				<tbody>
					<tr>
						<td>Pane top</td>
						<td>96px</td>
					</tr>
					<tr>
						<td>Pane header</td>
						<td>86px</td>
					</tr>
					<tr>
						<td>Reading body begins</td>
						<td>182px</td>
					</tr>
					<tr>
						<td>Section submenu</td>
						<td>44px, 16px above the bottom edge</td>
					</tr>
					<tr>
						<td>Reading body ends</td>
						<td>Viewport height − 60px</td>
					</tr>
					<tr>
						<td>Media area</td>
						<td>Top 96px, bottom 16px</td>
					</tr>
				</tbody>
			</table>
			<p>
				The pane's width chooses its own content grid. It reaches a 1200px grid container at a
				2456px viewport without a classic scrollbar or safe-area reductions. This is a
				container-grid change inside the same 3XL page composition.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'one-scroll-owner',
			title: 'One scroll owner',
			headline: 'One scroll owner',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				The body is ordinary document flow with 182px reserved before it and 60px after it. A
				content point at document-body offset <code>d</code> appears at
				<code>182 + d − scrollY</code>. The media region, pane material, header and submenu are
				fixed and do not create document height.
			</p>
			<p>
				Native fragment links, focus, Home/End, history and the final line therefore use the
				browser's document coordinates. A short document cannot invent extra scroll travel just to
				move an already visible anchor to the reading edge. There is no second vertical scroll
				container to trap wheel or keyboard input.
			</p>
			<p>
				Without JavaScript, page-colored covers bound the native reading area. Enhanced rendering
				clips painting and hit testing to the real pane window. The integrated summary stays native
				DOM, while the menu and media controls can use their appropriate surfaces. Opaque native
				covers are not represented as GPU glass refracting arbitrary HTML.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'resize-and-zoom-retain-state',
			title: 'Resize and zoom retain state',
			headline: 'Resize and zoom retain state',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Crossing 2XL/3XL preserves the reading section and its offset rather than blindly preserving
				the old numeric scrollY. The controller caches that anchor before CSS reflow and restores it
				after summary ownership and body height settle. A regression fixture holds Chapter 4 at
				182px, then 142px in 2XL, then 182px on return.
			</p>
			<p>
				Zoom continuously fades, blurs and moves the whole pane using the same damped focus curve as
				the properties panel in smaller layouts. Header, surface, body and submenu share one
				perspective pivot; the integrated summary does not receive a second animation. These are
				paint transforms, so document height, anchors and the reading position stay unchanged.
				Hidden controls become inert. Returning restores the same live inputs and scroll state. The
				left free region controls 3D while the visible right pane scrolls. With image/video
				selected, free areas scroll the document. With the pane hidden, the full free viewport
				controls the model; real controls still take priority.
			</p>
			<p>
				Use <code>/docs/examples/pane/</code> for anchors, reload, focus, late content and resize checks.
				Desktop WebGPU, native hydration and no-JavaScript cases are automated. Physical touch behavior
				and browser Find still need device-level review.
			</p>
		</div></Section
	>
</WebsitePage>
