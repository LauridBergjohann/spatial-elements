<script lang="ts">
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import WebsitePage from '$lib/WebsitePage.svelte';
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
		><p>
			Start with a SvelteKit application. Install the component package and its Three.js peer
			dependency:
		</p>
		<CodeBlock
			language="sh"
			code="npm install @spatial-elements/sveltekit@beta three@^0.186.1"
		/></Section
	>
	<Section
		section={{
			id: 'compose',
			title: '2. Compose',
			headline: '2. Compose',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Put one <code>BrandStageShell</code> in the layout shared by your collection and detail pages.
				Define an element with an ID, title, GLB geometry, HDR environment and fallback poster.
			</p>
			<p>
				Use <code>ContentPage</code> with a <code>HeadingSection</code> and
				<code>SpatialCardGridSection</code>
				for the collection. Use <code>SpatialElementPage</code> for each detail route.
			</p>
			<p>
				<a href="/docs/foundations/first-experience/"
					>Follow the complete example with route files and code →</a
				>
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'explore',
			title: '3. Explore',
			headline: '3. Explore',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>
			The <a href="https://github.com/LauridBergjohann/spatial-elements/tree/main/apps/demo"
				>minimal demo</a
			>
			is a small working starting point. Explore the <a href="/showcase/">showcase</a> for richer
			examples and the <a href="/docs/">documentation</a> for the details.
		</p></Section
	>
</WebsitePage>
