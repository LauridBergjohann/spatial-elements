<script module lang="ts">
	export const examples = [
		{
			language: 'ts',
			code: "import { getSpatialListItems, findSpatialElement } from '@spatial-elements/sveltekit';\nimport { elements } from '#lib/elements.ts';\n\nconst items = getSpatialListItems(elements, '/studio/elements');\nconst cube = findSpatialElement(elements, 'cube');"
		},
		{
			language: 'ts',
			code: "import { createSpatialTheme } from '@spatial-elements/sveltekit';\n\nconst theme = createSpatialTheme({\n  id: 'studio', name: 'My collection',\n  colors: { accent: '#007b5e' },\n  sectionBackgrounds: { standard: '#ffffff', muted: '#f2f2f2' }\n});"
		}
	];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<WebsitePage page={{ title: 'API and integration notes' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'API and integration notes',
			introduction:
				'Use high-level components for pages; reach for lower-level helpers only when composing a custom integration.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'introduction',
			title: 'Start with the field reference',
			headline: 'Start with the field reference',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The <a href="/docs/reference/components/">component tables</a> list each input; the
				<a href="/docs/reference/types/">data-type tables</a> explain required fields, nested objects
				and alternatives. Both are generated from the declarations used by this version of the package.
			</p>
			<p>
				The examples below use the SvelteKit package. Core data helpers are also exported by <code>
					@spatial-elements/core
				</code>.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'ownership-which-setting-belongs-where',
			title: 'Which setting belongs where?',
			headline: 'Which setting belongs where?',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<ul>
				<li>
					<a href="/docs/reference/types/#spatial-theme-options">
						<code>SpatialThemeOptions</code>
					</a> belongs to the layout: namespace, colors and surface appearance.
				</li>
				<li>
					<a href="/docs/reference/types/#content-page-data"><code>ContentPageData</code></a>
					describes a content route.
					<a href="/docs/reference/components/#content-page-hdr"><code>ContentPage.hdr</code></a> supplies
					its collection lighting.
				</li>
				<li>
					<a href="/docs/reference/types/#spatial-element-data"><code>SpatialElementData</code></a> describes
					one object and its detail environment.
				</li>
				<li>
					<a href="/docs/reference/types/#spatial-element-section-definition">
						<code>SpatialElementSectionDefinition</code>
					</a> describes one page-local section.
				</li>
				<li>
					<a href="/docs/reference/types/#spatial-card-grid-options">
						<code>SpatialCardGridOptions</code>
					</a> controls card presentation; it does not belong inside the section object.
				</li>
			</ul>
		</div>
	</Section><Section
		section={{
			id: 'element-data',
			title: 'Project and resolve element data',
			headline: 'Project and resolve element data',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/types/#spatial-list-item"><code>getSpatialListItems</code></a>
				derives collection links and asset information from your element documents.
				<a href="/docs/foundations/assets/"><code>findSpatialElement</code></a>
				resolves a single object by ID. The list helper keeps model identity separate from a repeated
				occurrence’s <code>itemKey</code>.
			</p>
			<CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
			<p>
				A list item’s <code>href</code> is a real application route, so implement the matching detail
				route. Native links support server rendering, keyboard navigation and history. Route-specific
				content belongs in the load function, not in the shared shell.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'geometry-details',
			title: 'Geometry and resource helpers',
			headline: 'Geometry and resource helpers',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Start with URL strings in <a href="/docs/reference/types/#spatial-element-geometry">
					<code>SpatialElementGeometry</code>
				</a>. Both low and high are required; identical URLs share one load.
				<code>geometryFromLodPair</code>
				adapts an existing
				<a href="/docs/reference/types/#spatial-element-lod-pair">
					<code>SpatialElementLodPair</code>
				</a> from an asset pipeline.
			</p>
			<p>
				Advanced pipelines can provide versioned <a
					href="/docs/reference/types/#spatial-element-asset-resource"
				>
					<code>SpatialElementAssetResource</code>
				</a> objects, shared bounds and a verified manifest. Declaring a common coordinate frame does
				not independently verify an object’s physical dimensions. Follow the type fields when integrating
				your own pipeline.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'shared-theme',
			title: 'Resolve theme defaults',
			headline: 'Resolve theme defaults',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/types/#spatial-theme-options"><code>createSpatialTheme</code></a>
				accepts
				<a href="/docs/reference/types/#spatial-theme-options"><code>SpatialThemeOptions</code></a>
				and returns a complete
				<a href="/docs/reference/types/#spatial-theme"><code>SpatialTheme</code></a>. It merges
				appearance groups with library defaults. The ID and name identify a collection; changing
				light or dark mode does not require a new ID.
			</p>
			<CodeBlock {...examples[1]} highlighted={data.highlights[1]} />
			<p>
				<code>resolveSpatialThemeRadii</code> resolves control and panel roles.
				<code>resolveSpatialSectionBackgrounds</code> resolves standard and muted colors. Use these when
				composing your own controls around the high-level components.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'svelte-components',
			title: 'Custom summaries and prepared destinations',
			headline: 'Custom summaries and prepared destinations',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The shell’s summary snippet receives <a
					href="/docs/reference/types/#spatial-summary-context"
				>
					<code>SpatialSummaryContext</code>
				</a>. Define it synchronously in the shared layout so inputs and other stateful content can
				stay mounted across presentations. The
				<a href="/docs/detail-pages/summaries/">summary guide</a> includes a complete custom component.
			</p>
			<p>
				<code>createCatalogEndpointAction</code> registers the actual title and other shared text nodes.
				Create it inside a child component below the shell; a parent above the shell cannot access that
				context. Do not register a screenshot in place of interactive content.
			</p>
			<p>
				For a known fragment destination, an authored <code>targetPresentation</code> of dock
				asserts that the destination opens its fully docked content view. Only use it for an actual
				section anchor. The experimental source-first transition still requires
				<code>?stagedNavigation=1</code> on the source and prepared endpoints; the declaration alone does
				not enable that path. Ordinary navigation remains available.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'renderer-infrastructure',
			title: 'Renderer infrastructure',
			headline: 'Renderer infrastructure',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#brand-stage-shell-render-settings">
					<code>BrandStageShell.renderSettings</code>
				</a>
				accepts
				<a href="/docs/reference/types/#stage-render-settings"><code>StageRenderSettings</code></a>.
				The defaults limit pixel ratio to 1 and rendered area to 2,073,600 pixels; the tighter
				budget wins. DOM text keeps its native resolution. See
				<a href="/docs/advanced/performance/">Performance</a>.
			</p>
			<p>
				<a href="/docs/reference/components/#brand-stage-shell-draco-decoder-path">
					<code>dracoDecoderPath</code>
				</a> points to a host-served decoder directory with a trailing slash. The default is /assets/draco/gltf/.
				The package does not install models or decoders into your application’s static directory. Meshopt
				uses the Three.js decoder dependency.
			</p>
			<p>
				Stage, Panel, StageViewport and StageExperience are lower-level integration tools. Page
				components already register their content; do not repeat their models in a manual Stage
				catalog. Use the public page components unless you are deliberately implementing an
				alternative renderer adapter.
			</p>
		</div>
	</Section>
</WebsitePage>
