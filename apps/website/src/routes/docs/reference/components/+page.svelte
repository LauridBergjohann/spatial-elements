<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
	import ReferenceTables from '#lib/docs/ReferenceTables.svelte';
</script>

<WebsitePage page={{ title: 'Component properties' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Component properties',
			introduction: 'The public inputs of the shell, page containers and spatial sections.',
			headingLevel: 1,
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'using-properties',
			title: 'Using properties',
			headline: 'Follow an input to its data',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Import these components from <code>@spatial-elements/sveltekit</code>. Properties such as
				<code>cardSize</code>
				are passed directly to the component. The <code>section</code>, <code>page</code> and
				<code>spatialElement</code> properties are objects; their linked types explain each field.
			</p>
			<p>
				Required properties must be supplied. Optional snippets provide Svelte markup. The tables
				follow the component declarations, including inherited card options. For a complete example,
				return to <a href="/docs/sections/composition/">ContentPage and sections</a> or
				<a href="/docs/detail-pages/structure/">Detail structure</a>.
			</p>
		</div>
	</Section>
	<ReferenceTables kind="component" />
</WebsitePage>
