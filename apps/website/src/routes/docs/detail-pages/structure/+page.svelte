<script module lang="ts">
	export const examples = [
		{
			language: 'ts',
			code: "import { error } from '@sveltejs/kit';\nimport { findSpatialElement } from '@spatial-elements/sveltekit';\nimport { elements } from '#lib/elements.ts';\nimport type { PageLoad } from './$types';\n\nexport const load: PageLoad = ({ params }) => {\n  const element = findSpatialElement(elements, params.id);\n  if (!element) error(404, 'Element not found');\n  return { element };\n};"
		},
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';\n  let { data } = $props();\n\u003c/script>\n\n\u003cSpatialElementPage spatialElement={data.element}>\n  \u003cSection section={{ id: 'story', title: 'The story', headline: 'A closer look', background: { color: 'standard' } }}>\n    \u003cp>Explain what makes this object useful or interesting.\u003c/p>\n  \u003c/Section>\n  \u003cSection section={{ id: 'materials', title: 'Materials', headline: 'Made to last', background: { color: 'muted' } }}>\n    \u003cp>Add materials, images or other ordinary content.\u003c/p>\n  \u003c/Section>\n\u003c/SpatialElementPage>"
		}
	];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<WebsitePage page={{ title: 'Detail structure and sections' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Detail structure and sections',
			introduction:
				'Resolve one element in the route and compose its story with Section components.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'route-data',
			title: 'Load one element',
			headline: 'Load one element',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Create a route such as <code>src/routes/studio/elements/[id]/</code>. It must match the
				prefix you passed to
				<a href="/docs/reference/types/#spatial-list-item"><code>getSpatialListItems</code></a>.
				Resolve the element in the route's load function and return a 404 when the ID is unknown.
			</p>
			<CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
			<p>
				Only the selected element belongs in this route's data. The shared layout still owns the
				stage and theme.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'detail-component',
			title: 'Compose the detail page',
			headline: 'Compose the detail page',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#spatial-element-page">
					<code>SpatialElementPage</code>
				</a>
				supplies the main area, model view, summary, media selector and section navigation. Add your content
				as children. The spatial
				<a href="/docs/reference/components/#section"><code>Section</code></a> automatically registers
				its anchor and title with the page navigation.
			</p>
			<CodeBlock {...examples[1]} highlighted={data.highlights[1]} />
			<p>
				Choose meaningful, unique <a
					href="/docs/reference/types/#spatial-element-section-definition-id"
				>
					<code>section.id</code>
				</a>
				values. Keep
				<a href="/docs/reference/types/#spatial-element-section-definition-title">
					<code>section.title</code>
				</a>
				short for the navigation, and use
				<a href="/docs/reference/types/#spatial-element-section-definition-headline">
					<code>section.headline</code>
				</a>
				for the visible heading. A normal link to <code>#materials</code> can open that part of the story.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'summary-and-content',
			title: 'Give each area a purpose',
			headline: 'Give each area a purpose',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The summary gives visitors the essential information and main action. The sections explain
				the object in depth: materials, photographs, specifications or a story. Avoid putting the
				entire article into the summary panel.
			</p>
			<p>
				Use <a href="/docs/reference/components/#spatial-element-page-header-details">
					<code>headerDetails</code>
				</a>
				for compact controls needed in a docked header, and
				<a href="/docs/reference/components/#spatial-element-page-action-icon">
					<code>actionIcon</code>
				</a> to supply its action icon. The next chapter explains how those controls relate to a shared
				custom summary.
			</p>
			<p>
				<a href="/showcase/consumer/logitech-brio-500/">Follow the section links on Brio 500 →</a>
			</p>
		</div>
	</Section>
</WebsitePage>
