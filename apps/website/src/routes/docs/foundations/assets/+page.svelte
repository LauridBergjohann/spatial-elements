<script module lang="ts">
	export const examples = [
		{
			language: 'ts',
			code: "import type { SpatialElementData } from '@spatial-elements/sveltekit';\n\n// src/lib/elements.ts — supply these files in static/assets/\nexport const elements: SpatialElementData[] = [{\n  id: 'cube',\n  title: 'Cube',\n  eyebrow: 'Form study',\n  description: 'A simple form to explore from every side.',\n  geometry: { low: '/assets/cube.glb', high: '/assets/cube.glb' },\n  hdr: '/assets/studio.hdr',\n  fallbackImage: '/assets/cube.webp',\n  fallbackImageSize: [800, 800]\n}];"
		},
		{
			language: 'ts',
			code: "import { getSpatialListItems } from '@spatial-elements/sveltekit';\nimport { elements } from '#lib/elements.ts';\n\n// src/routes/studio/categories/list/+page.ts\nexport function load() {\n  return { items: getSpatialListItems(elements, '/studio/elements') };\n}"
		}
	];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Models and element data' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Models and element data',
			introduction: 'Describe an object once, then use it in a collection and on its detail page.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'one-document',
			title: 'What is an element?',
			headline: 'What is an element?',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				An element is one object you want to present: a product, sculpture or component. A <a
					href="/docs/reference/types/#spatial-element-data"
				>
					<code>SpatialElementData</code>
				</a> document combines its readable content with its model settings. Start with a title, two model
				URLs and an environment.
			</p>
			<DocFigure
				name="element-data"
				alt="An element document is projected to list items for collections and used directly by the detail page."
				caption="One source of truth keeps collection titles, detail views and model identity consistent."
			/><CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
		</div>
	</Section><Section
		section={{
			id: 'required-fields',
			title: 'Four required fields',
			headline: 'Four required fields',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/types/#spatial-element-data-id"><code>id</code></a> is a stable
				identifier;
				<a href="/docs/reference/types/#spatial-element-data-title"><code>title</code></a>
				is the visible name;
				<a href="/docs/reference/types/#spatial-element-data-geometry"><code>geometry</code></a>
				supplies the models;
				<a href="/docs/reference/types/#spatial-element-data-hdr"><code>hdr</code></a>
				supplies the detail environment. The linked fields in
				<a href="/docs/reference/types/#spatial-element-data"><code>SpatialElementData</code></a>
				explain optional values such as
				<a href="/docs/reference/types/#spatial-element-data-features"><code>features</code></a>,
				<a href="/docs/reference/types/#spatial-element-data-action"><code>action</code></a>
				and <a href="/docs/reference/types/#spatial-element-data-media"><code>media</code></a>.
			</p>
			<p>
				Both <a href="/docs/reference/types/#spatial-element-geometry-low">
					<code>geometry.low</code>
				</a>
				and
				<a href="/docs/reference/types/#spatial-element-geometry-high">
					<code>geometry.high</code>
				</a> are required. Low is the lightweight model for collections and transitions; high is the detailed
				version. Both must share origin, scale and orientation. For a small model, use one URL for both;
				the resource load is shared.
			</p>
			<p>
				<a href="/docs/reference/types/#spatial-element-data-fallback-image">
					<code>fallbackImage</code>
				</a>
				is strongly recommended. Supply its actual pixel dimensions in
				<a href="/docs/reference/types/#spatial-element-data-fallback-image-size">
					<code>fallbackImageSize</code>
				</a>. A poster lets a visitor understand and open the item before the model loads, without
				JavaScript or without WebGPU.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'collection-data',
			title: 'Project the collection data',
			headline: 'Project the collection data',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/types/#spatial-list-item"><code>getSpatialListItems</code></a>
				produces <a href="/docs/reference/types/#spatial-list-item"><code>SpatialListItem</code></a> objects
				from your element documents. It supplies the links, card content and model data needed by the
				CardGrid or Carousel. The second argument is your detail-route prefix; you must implement that
				route.
			</p>
			<CodeBlock {...examples[1]} highlighted={data.highlights[1]} />
			<p>
				This example points the cube to <code>/studio/elements/cube/</code>. Keep the ID stable when
				filtering or sorting. If one element appears twice within a single section, give its
				occurrences distinct <code>itemKey</code> values.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'lighting',
			title: 'Page lighting and model presentation',
			headline: 'Page lighting and model presentation',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A collection sets its own <a href="/docs/reference/components/#content-page-hdr">
					<code>ContentPage.hdr</code>
				</a>; it is not inferred from its first item. A detail page uses the element's
				<a href="/docs/reference/types/#spatial-element-data-hdr"><code>hdr</code></a>. Background
				tinting changes the visible environment, while the HDR still lights the model.
			</p>
			<p>
				Only adjust <a href="/docs/reference/types/#spatial-element-data-model">
					<code>model</code>
				</a>, <a href="/docs/reference/types/#spatial-element-data-camera"><code>camera</code></a>
				or <a href="/docs/reference/types/#spatial-element-data-minimap"><code>minimap</code></a>
				after the basic page works. Their field tables explain units and framing. The
				<a href="/docs/advanced/performance/">performance guide</a> covers model budgets and loading.
			</p>
		</div>
	</Section>
</WebsitePage>
