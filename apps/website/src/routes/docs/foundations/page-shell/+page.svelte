<script module lang="ts">
	export const examples = [
		{
			language: 'svelte',
			code: "\u003cscript lang=\"ts\">\n  import { PageShell, Footer } from '@page-sections/svelte';\n  import { BrandStageShell, createSpatialTheme } from '@spatial-elements/sveltekit';\n  import '@page-sections/svelte/styles.css';\n  let { children } = $props();\n  const theme = createSpatialTheme({ id: 'studio', name: 'My collection' });\n  const items = [{ id: 'collection', label: 'Collection', href: '/studio/categories/list/' }];\n\u003c/script>\n\n\u003cPageShell mode=\"light\">\n  \u003cBrandStageShell {theme} {items} colorScheme=\"light\">\n    {#snippet brand()}\u003ca href=\"/\">My collection\u003c/a>{/snippet}\n    {@render children()}\n    {#snippet footer()}\n      \u003cFooter footnote=\"My collection\" links={[{ label: 'About', href: '/about/' }]} />\n    {/snippet}\n  \u003c/BrandStageShell>\n\u003c/PageShell>"
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

<WebsitePage page={{ title: 'Layout, pages and navigation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Layout, pages and navigation',
			introduction:
				'Keep the shared website shell in +layout.svelte and route content in +page.svelte.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'semantic-page',
			title: 'Start with semantic HTML',
			headline: 'Start with semantic HTML',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A website usually has a <code>header</code> for navigation, one <code>main</code> for the
				current page and a
				<code>footer</code> for shared links. SvelteKit keeps a layout mounted while its child routes
				change. This is the right place for the theme, shared stage, header and site footer.
			</p>
			<DocFigure
				name="site-shell"
				alt="Header and footer surround one main area, which contains either a ContentPage or a SpatialElementPage."
				caption="Both kinds of page live under the same layout. Do not nest one page component inside another."
			/>
		</div>
	</Section><Section
		section={{
			id: 'persistent-layout',
			title: 'Create the shared layout',
			headline: 'Create the shared layout',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="https://page-sections.bergjohann.com/docs/page-layout/"><code>PageShell</code></a>
				applies the HTML theme.
				<a href="/docs/reference/components/#brand-stage-shell"><code>BrandStageShell</code></a>
				shares the spatial theme and rendering resources.
				<a href="/docs/reference/types/#spatial-theme-options"><code>createSpatialTheme</code></a> fills
				in defaults, so you start with just a stable namespace and a readable name.
			</p>
			<p>
				Put this in <code>src/routes/+layout.svelte</code>. The shell renders navigation from
				<a href="/docs/reference/components/#brand-stage-shell-items"><code>items</code></a>; the
				<a href="/docs/reference/components/#brand-stage-shell-brand"><code>brand</code></a>
				and <a href="/docs/reference/components/#brand-stage-shell-footer"><code>footer</code></a> snippets
				provide the site's identity and footer.
			</p>
			<CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
			<p>
				The theme ID identifies a collection of related routes. It is not the current object's ID.
				Keep it stable across collection and detail pages. Use a nested layout if only part of your
				site needs a stage.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'route-content',
			title: 'Give each page its own content',
			headline: 'Give each page its own content',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				In a route's <code>+page.svelte</code>, use exactly one main page container:
				<a href="/docs/reference/components/#content-page"><code>ContentPage</code></a>
				for a collection or article, or
				<a href="/docs/reference/components/#spatial-element-page">
					<code>SpatialElementPage</code>
				</a>
				for one object's detail view. Your <code>+page.ts</code> or <code>+page.server.ts</code> load
				function supplies the route's data.
			</p>
			<p>
				Do not collect every model or every page's content in the layout. Page components register
				their own data with the stage. Keep route links as ordinary anchors, so keyboard navigation,
				history and server rendering work.
			</p>
			<p>
				The <a href="https://page-sections.bergjohann.com/docs/page-layout/">
					Page Sections page-layout guide
				</a> covers header composition, breadcrumbs and content sidebars in more depth.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'shared-footer',
			title: 'One footer for all routes',
			headline: 'One footer for all routes',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Use the shell's <a href="/docs/reference/components/#brand-stage-shell-footer">
					<code>footer</code>
				</a>
				snippet for the website footer. The
				<a href="/docs/reference/components/#content-page"><code>ContentPage</code></a> footer snippet
				has a different purpose: page-local content such as previous/next links.
			</p>
			<p>
				The site footer follows the page, including ultrawide detail pages. The document first
				scrolls through the detail content; at its end, the footer scrolls over the stationary
				stage. Keep that shared footer outside your individual sections.
			</p>
		</div>
	</Section>
</WebsitePage>
