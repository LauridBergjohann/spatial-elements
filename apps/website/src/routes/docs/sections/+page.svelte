<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Content pages' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Content pages',
			introduction:
				'Compose ordinary content and spatial collections using the same section system.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'choose-a-section',
			title: 'Build a page from sections',
			headline: 'Build a page from sections',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A content page is a route that presents a collection, an introduction or an article. It can
				combine ordinary Page Sections components with spatial sections. Use <a
					href="/docs/reference/components/#spatial-card-grid-section"
				>
					<code>SpatialCardGridSection</code>
				</a>
				to compare multiple items; use
				<a href="/docs/reference/components/#spatial-carousel-section">
					<code>SpatialCarouselSection</code>
				</a> to focus on one at a time.
			</p>
			<DocFigure
				name="collections"
				alt="A grid displays several cards side by side; a carousel emphasizes one item and its summary."
				caption="Choose the presentation for the task. Both consume the same list-item data."
			/>
		</div>
	</Section><Section
		section={{
			id: 'chapter-route',
			title: 'In this chapter',
			headline: 'In this chapter',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Start with <a href="/docs/sections/composition/">ContentPage and sections</a>, then try the
				dedicated <a href="/docs/sections/card-grid/">CardGrid</a> and
				<a href="/docs/sections/carousel/">Carousel</a> examples. Finish with backgrounds and the combined
				playground.
			</p>
			<p>
				The <a href="/showcase/consumer/">Consumer showcase</a> uses complete product content. The
				<a href="/docs/examples/grid/">grid example</a> isolates the shared layout system.
			</p>
		</div>
	</Section>
</WebsitePage>
