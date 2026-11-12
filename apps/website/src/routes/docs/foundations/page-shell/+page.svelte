<script lang="ts">
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Page shell and navigation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Page shell and navigation',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'ownership',
			title: 'One shell, many pages',
			headline: 'One shell, many pages',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<code>BrandStageShell</code> belongs in the shared SvelteKit layout. It owns the persistent stage,
				theme and model resources while collection and detail routes change inside it. Keeping it mounted
				makes transitions possible.
			</p>
			<p>
				Use the Spatial Elements <code>ContentPage</code> for collections and mixed spatial content,
				with an explicit <code>hdr</code> for lighting. It wraps the Page Sections content layout and
				registers the page with the shared stage. For ordinary documentation without 3D, use Page Sections
				directly; no stage is required.
			</p>
			<p>
				The <code>page</code> object supplies metadata and breadcrumbs. It does not create a visible
				page heading. Place a Page Sections <code>HeadingSection</code> with
				<code>headingLevel: 1</code> among the children, or use a Hero section. Its background and position
				are yours to choose.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'navigation',
			title: 'Navigation and sidebars',
			headline: 'Navigation and sidebars',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Provide a Page Sections <code>Navigation</code> and a single navigation tree in your
				application shell. Every entry has a real page URL. Derive the active path, breadcrumbs and
				sidebar items with <code>resolveNavigation</code>.
			</p>
			<p>
				When sharing a complete Page Sections navigation with non-spatial routes, pass it as the <code
					>navigation</code
				>
				snippet on <code>BrandStageShell</code>. The spatial shell then owns its positioning, scroll
				compensation and surfaces. Keep the menu inside that shell so it reserves space above the
				detail page.
			</p>
			<p>
				The header and satellites share the theme's <code>panelTheme</code>: frosted surfaces use
				its tint, opacity, backdrop blur and shadow, including without WebGPU. This website keeps
				one shell and one light/dark palette across documentation and the combined showcase.
			</p>
			<p>
				The Spatial Elements <code>ContentPage</code> accepts <code>leftSidebar</code> and
				<code>footer</code>
				snippets. Pass a <code>SidebarNavigation</code> into the left snippet. Set
				<code>showContentMenu</code>
				to generate the right menu from section headings; H1 is excluded and H3 is indented beneath H2.
				<code>contentMenuLabel</code> changes its accessible label.
			</p>
			<p>
				The sidebar layout, sticky positioning and compact-screen content-menu popup come from Page
				Sections. The right sidebar docks to consistently solid, standard-width sections and floats
				when sections use full-width or transparent surfaces.
			</p>
			<p>
				This documentation demonstrates those components. See the <a
					href="https://page-sections.bergjohann.com/">Page Sections documentation</a
				> for the complete navigation and heading APIs.
			</p>
		</div>
	</Section>
	<Section
		section={{
			id: 'routes',
			title: 'Collection and detail routes',
			headline: 'Collection and detail routes',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Choose URLs that suit your content, such as <code>/showcase/</code>,
				<code>/gallery/</code> and <code>/products/[slug]/</code>. Transitions match registered
				elements across spatial grids, carousels and detail pages. The theme ID identifies the
				collection; it does not have to match a URL prefix. Keep it and your element IDs stable.
			</p>
			<p>
				Use native links so navigation also works without JavaScript. <code
					>getSpatialListItems</code
				>
				derives detail links from your element data and an explicit route prefix. You can also provide
				each item's own <code>href</code>. Spatial sections register those destinations
				automatically. Supply a poster for each model so cards and detail pages stay useful without
				WebGPU.
			</p>
			<p>
				<a href="/docs/foundations/first-experience/"
					>Build the complete collection and detail example</a
				>, then explore
				<a href="/docs/sections/playground/">the interactive collection playground</a>.
			</p>
		</div>
	</Section>
</WebsitePage>
