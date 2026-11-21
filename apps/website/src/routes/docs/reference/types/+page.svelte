<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import ReferenceTables from '#lib/docs/ReferenceTables.svelte';
</script>

<WebsitePage page={{ title: 'Data types' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Data types',
			introduction:
				'Inspect required fields, optional values and nested objects without leaving the learning path.',
			headingLevel: 1,
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'reading-types',
			title: 'Reading types',
			headline: 'How to read these tables',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				These tables are generated from the package declarations. Click a field for its direct link;
				follow a named type to inspect its fields. Inherited fields are included. Dotted names such
				as <code>summary.sectionLink.href</code> describe an object nested inside another object.
			</p>
			<p>
				<code>[]</code> means an array; <code>|</code> separates alternatives. A question mark means
				optional. <code>Partial</code> makes fields optional, <code>Pick</code> selects fields and
				<code>Omit</code> excludes them. Each media alternative has its own required fields. A field marked
				Required inside an optional parent is needed only when that parent is supplied.
			</p>
			<p>
				Start with <a href="#spatial-element-data">SpatialElementData</a> for an object,
				<a href="#spatial-list-item">SpatialListItem</a>
				for its collection view and <a href="#spatial-theme-options">SpatialThemeOptions</a> for
				theme creation. <a href="/docs/reference/components/">Component properties</a> shows where these
				objects are used.
			</p>
			<p>
				Page Sections types link to its own reference. Svelte's <code>Snippet</code> is a fragment of
				markup, not serializable route data. Advanced rendering types may contain Three.js values; the
				common model workflow only requires URL strings.
			</p>
		</div>
	</Section>
	<ReferenceTables kind="type" />
</WebsitePage>
