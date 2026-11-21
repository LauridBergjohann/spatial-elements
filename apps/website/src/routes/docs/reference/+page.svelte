<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Reference' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Reference',
			introduction:
				'Find a component, follow a property to its data shape and inspect the nested fields.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'lookup',
			title: 'Choose a reference',
			headline: 'Choose a reference',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<ul>
				<li>
					<a href="/docs/reference/components/">Component properties</a> — The shell, page containers,
					CardGrid and Carousel inputs.
				</li>
				<li>
					<a href="/docs/reference/types/">Data types</a> — Required and optional fields, nested objects
					and their declarations.
				</li>
				<li>
					<a href="/docs/reference/api/">API and integration notes</a> — Helpers and advanced integration
					contracts.
				</li>
				<li>
					<a href="/docs/reference/layout-tokens/">Layout tokens</a> — Exact sizes and layout rules.
				</li>
			</ul>
			<p>
				For example, follow <a href="/docs/reference/types/#spatial-element-data">
					<code>SpatialElementData</code>
				</a>
				to its
				<a href="/docs/reference/types/#spatial-element-data-geometry"><code>geometry</code></a>
				field, then open
				<a href="/docs/reference/types/#spatial-element-geometry">
					<code>SpatialElementGeometry</code>
				</a>
				to inspect its
				<a href="/docs/reference/types/#spatial-element-geometry-low"><code>low</code></a>
				and <a href="/docs/reference/types/#spatial-element-geometry-high"><code>high</code></a> sources.
			</p>
		</div>
	</Section>
</WebsitePage>
