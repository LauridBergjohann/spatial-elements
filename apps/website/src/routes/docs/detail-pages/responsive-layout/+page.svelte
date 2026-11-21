<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Scrolling and ultrawide layouts' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Scrolling and ultrawide layouts',
			introduction:
				'Let visitors move from exploring an object to reading its story, without losing their place.',
			headingLevel: 1,
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'composition',
			title: 'One page, different compositions',
			headline: 'One page, different compositions',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				On regular screens, the model and summary introduce the object, followed by its content
				sections. As the visitor scrolls into the story, compact controls keep important information
				within reach. On ultrawide screens, the model remains beside a reading pane.
			</p>
			<DocFigure
				name="detail-layout"
				alt="Regular layouts place sections below the model. Ultrawide layouts place a scrolling reading pane to its right."
				caption="The same element and sections support both compositions. You do not author a separate desktop page."
			/>
			<p>
				The <a href="/docs/foundations/layout/">responsive-layout foundation</a> defines the layout sizes.
				The ultrawide composition starts at 3XL, with at least 512 CSS pixels of usable height. Shorter
				windows keep the regular flow.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'docking',
			title: 'Docking while reading',
			headline: 'Keep the object within reach',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Docking is the compact presentation of the object's information while its story is being
				read. The title, main action and section navigation remain available. The minimap is a small
				interactive view of the model that helps visitors return their attention to the object.
			</p>
			<p>
				Section links move through the same document. The page updates the active section as the
				reader scrolls. Keep section labels concise and let the library position these controls;
				adding your own fixed scrolling wrapper can interfere with that composition.
			</p>
			<p><a href="/docs/examples/docking/">Try docking with short and long sections →</a></p>
		</div>
	</Section>
	<Section
		section={{
			id: 'ultrawide',
			title: 'The ultrawide reading pane',
			headline: 'Use the extra width deliberately',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				At 3XL the media area stays on the left, with summary, sections and navigation on the right.
				The reading pane uses the same container-based content grid as any other content area. A
				wide viewport therefore does not force oversized columns into a narrower pane.
			</p>
			<p>
				The pane has no independent vertical scrollbar: the document still scrolls. That keeps
				anchors, keyboard navigation and browser history connected to one page. Zoom and fullscreen
				can give the model more room without changing the authored content.
			</p>
			<p>
				<a href="/docs/examples/pane/">Open the reading-pane example</a> in a wide window, change
				its content and follow the section links. The
				<a href="/docs/reference/detail-layout/">layout gallery</a>
				shows the compositions when your screen is narrower. Exact pane dimensions are in
				<a href="/docs/advanced/reading-pane/">Reading pane geometry</a>.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'footer',
			title: 'Reaching the footer',
			headline: 'The footer follows the story',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The shared footer belongs in <a href="/docs/reference/components/#brand-stage-shell-footer">
					<code>BrandStageShell.footer</code>
				</a>. When the detail content ends, further document scrolling brings it over the stationary
				stage. The space before it retains the scene background, just like the spaces between
				sections.
			</p>
			<p>
				<a href="/showcase/consumer/logitech-brio-500/">Open Brio 500</a>, scroll through its story
				to the footer, then scroll back. Try the same route in a narrow and an ultrawide window. No
				route-specific footer or extra vertical scroller is needed.
			</p>
		</div>
	</Section>
</WebsitePage>
