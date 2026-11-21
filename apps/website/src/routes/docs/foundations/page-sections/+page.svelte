<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Built on Page Sections' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Built on Page Sections',
			introduction: 'One content system for ordinary website sections and spatial experiences.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'sections',
			title: 'What is a section?',
			headline: 'What is a section?',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A section groups related content under one purpose. A heading and paragraph might introduce
				a collection; a card grid lets visitors compare its items. Sections have an anchor, a
				navigation label and an optional visible headline.
			</p>
			<p>
				<a href="https://page-sections.bergjohann.com/docs/">Page Sections</a> supplies these content
				building blocks, plus page containers, navigation, themes and a responsive grid. Spatial Elements
				uses Page Sections 0.5.1 as its foundation.
			</p>
			<DocFigure
				name="foundations"
				alt="The content foundation supplies HTML, cards and grid; the spatial layer supplies models and interactions."
				caption="You can mix Page Sections content with spatial sections on the same page."
			/>
		</div>
	</Section><Section
		section={{
			id: 'shared-layout',
			title: 'The same grid and layout system',
			headline: 'The same grid and layout system',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The <a href="https://page-sections.bergjohann.com/docs/reference/types/#content-span">
					<code>ContentGrid</code>
				</a> component arranges blocks in columns. Its columns follow the width of its container, so the
				same content works in a full page, beside a sidebar or inside a detail pane. You do not need a
				second grid system for 3D cards.
			</p>
			<p>
				A <a href="/docs/reference/components/#content-page"><code>ContentPage</code></a> is the
				main content area of a route. Spatial Elements wraps the Page Sections version and connects
				it to a shared stage. Use the spatial
				<a href="/docs/reference/components/#content-page"><code>ContentPage</code></a> when composing
				spatial sections; use ordinary Page Sections headings, text, images and other content inside it.
			</p>
			<p>
				We will introduce the exact sizes in <a href="/docs/foundations/layout/">
					Responsive layout
				</a>. For the underlying content components, see
				<a href="https://page-sections.bergjohann.com/docs/building-blocks/">
					Page Sections components
				</a>.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'spatial-layer',
			title: 'What Spatial Elements adds',
			headline: 'What Spatial Elements adds',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The <a href="/docs/reference/components/#brand-stage-shell"><code>BrandStageShell</code></a>
				keeps one stage alive around related routes. A stage is a rendering layer, not another content
				page.
				<a href="/docs/reference/components/#spatial-card-grid-section">
					<code>SpatialCardGridSection</code>
				</a>
				shows multiple models in a grid;
				<a href="/docs/reference/components/#spatial-carousel-section">
					<code>SpatialCarouselSection</code>
				</a>
				focuses on one object at a time.
				<a href="/docs/reference/components/#spatial-element-page">
					<code>SpatialElementPage</code>
				</a> presents one object in detail.
			</p>
			<p>
				Those names describe the pieces you will build in later chapters. The HTML remains the
				website: supplied posters, text and native links are available before the spatial layer
				starts and when WebGPU is unavailable.
			</p>
		</div>
	</Section>
</WebsitePage>
