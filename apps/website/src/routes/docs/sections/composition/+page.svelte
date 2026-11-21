<script module lang="ts">
	export const examples = [
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { HeadingSection } from '@page-sections/svelte';\n  import { ContentPage, Section, SpatialCardGridSection } from '@spatial-elements/sveltekit';\n  let { data } = $props();\n\u003c/script>\n\n\u003cContentPage hdr=\"/assets/studio.hdr\" page={{ title: 'My collection' }} showContentMenu>\n  \u003cHeadingSection section={{ id: 'title', title: 'My collection', headingLevel: 1 }} />\n  \u003cSection section={{ id: 'introduction', title: 'Introduction', headline: 'Meet the collection' }}>\n    \u003cp>Objects to explore from every side.\u003c/p>\n  \u003c/Section>\n  \u003cSpatialCardGridSection\n    section={{ id: 'objects', title: 'Objects', headline: 'Choose an object' }}\n    list={data.items}\n  />\n\u003c/ContentPage>"
		}
	];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<WebsitePage page={{ title: 'ContentPage and sections' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'ContentPage and sections',
			introduction: 'Give a route one main area, then arrange its content as meaningful sections.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'main-content',
			title: 'The page container',
			headline: 'The page container',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#content-page"><code>ContentPage</code></a> from Spatial
				Elements wraps the Page Sections content container and connects the route to the persistent
				stage. Its <a href="/docs/reference/components/#content-page-page"><code>page</code></a>
				object describes the route; its required
				<a href="/docs/reference/components/#content-page-hdr"><code>hdr</code></a> selects the environment
				used to light the collection.
			</p>
			<p>
				<a href="/docs/reference/types/#content-page-data-title"><code>page.title</code></a>
				supplies metadata, not a visible heading. Add a
				<a href="https://page-sections.bergjohann.com/sections/heading/">
					<code>HeadingSection</code>
				</a> with heading level 1 at the beginning of the content. Use section headings below it in a
				logical hierarchy.
			</p>
			<CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
		</div>
	</Section><Section
		section={{
			id: 'section-metadata',
			title: 'Anchor, label and headline',
			headline: 'Anchor, label and headline',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/types/#spatial-element-section-definition-id">
					<code>section.id</code>
				</a>
				is a unique anchor on this page.
				<a href="/docs/reference/types/#spatial-element-section-definition-title">
					<code>section.title</code>
				</a>
				labels the section in navigation and for assistive technology.
				<a href="/docs/reference/types/#spatial-element-section-definition-headline">
					<code>section.headline</code>
				</a> is its visible heading; omit it when the content needs no displayed heading.
			</p>
			<p>
				Use the spatial <a href="/docs/reference/components/#section"><code>Section</code></a> for content
				that should join the detail navigation or use the spatial surface treatment. Page Sections' ready-made
				headings, rich text and image sections can be mixed into content pages.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'sidebars',
			title: 'Sidebars and the content menu',
			headline: 'Sidebars and the content menu',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A <a href="/docs/reference/components/#content-page-left-sidebar">
					<code>leftSidebar</code>
				</a>
				snippet can hold chapter navigation. Enable
				<a href="/docs/reference/components/#content-page-show-content-menu">
					<code>showContentMenu</code>
				</a> to expose navigation between sections. The page adjusts their placement as space changes,
				while your content follows the width available to it.
			</p>
			<p>
				There is no need to choose a device class in every section. Review <a
					href="/docs/foundations/layout/"
				>
					Responsive layout
				</a> when you need exact container sizes or custom columns.
			</p>
			<p><a href="/docs/examples/grid/">Try different content widths and column spans →</a></p>
		</div>
	</Section><Section
		section={{
			id: 'next-section',
			title: 'Add a collection',
			headline: 'Add a collection',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The example uses the list from the preceding <a href="/docs/foundations/assets/">
					element-data guide
				</a>. Next, explore the CardGrid settings and their live preview. You can add a Carousel
				further down the same page without another stage or page wrapper.
			</p>
		</div>
	</Section>
</WebsitePage>
