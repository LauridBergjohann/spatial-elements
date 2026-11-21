<script lang="ts">
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import WebsitePage from '#lib/WebsitePage.svelte';
</script>

<WebsitePage page={{ title: 'Getting started' }} showSidebar={false}>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Your first spatial experience',
			headingLevel: 1,
			headingSize: 'm'
		}}
	/>
	<Section
		section={{
			id: 'install',
			title: '1. Install',
			headline: '1. Install',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<p>
			Start with a Svelte 5 / SvelteKit 3 application. Spatial Elements adds model collections and
			detail views to the content layout provided by Page Sections. Install both component packages:
		</p>
		<CodeBlock
			language="sh"
			code="npm install @spatial-elements/sveltekit@beta @page-sections/svelte@0.5.1"
		/>
	</Section>
	<Section
		section={{
			id: 'compose',
			title: '2. Compose',
			headline: '2. Compose',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A section is one meaningful part of a page. A stage is the shared rendering layer that adds
				models to those sections. Keep that stage in your shared SvelteKit layout using
				<a href="/docs/foundations/page-shell/"><code>BrandStageShell</code></a>. Then describe each
				object with its title, model, lighting and poster in a
				<a href="/docs/reference/types/#spatial-element-data"><code>SpatialElementData</code></a> document.
			</p>
			<p>
				A <a href="/docs/sections/composition/"><code>ContentPage</code></a> contains a route's main
				content. Add a heading and a <a href="/docs/sections/card-grid/">CardGrid</a> or
				<a href="/docs/sections/carousel/">Carousel</a> to show a collection. A
				<a href="/docs/detail-pages/structure/"><code>SpatialElementPage</code></a> presents one object
				and its story.
			</p>
			<p>
				<a href="/docs/foundations/page-sections/">
					Follow the learning path, starting with the shared foundation →
				</a>
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'explore',
			title: '3. Explore',
			headline: '3. Explore',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<p>
			The <a href="https://github.com/LauridBergjohann/spatial-elements/tree/main/apps/demo">
				minimal demo
			</a>
			is a small working starting point. Explore the <a href="/showcase/">showcase</a> for richer
			examples and the <a href="/docs/">documentation</a> for the details.
		</p>
	</Section>
</WebsitePage>
