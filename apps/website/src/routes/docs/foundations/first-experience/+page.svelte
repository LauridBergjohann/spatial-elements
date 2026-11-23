<script module lang="ts">
	export const examples = [
		{
			language: 'sh',
			code: 'npm install @spatial-elements/sveltekit@beta @page-sections/svelte@0.6.0'
		},
		{
			language: 'svelte',
			code: '\u003cscript lang="ts">\n  import \'@page-sections/svelte/styles.css\';\n  let { children } = $props();\n\u003c/script>\n\n{@render children()}'
		}
	];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<WebsitePage page={{ title: 'Installation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Installation',
			introduction: 'Prepare a SvelteKit application and the assets it will serve.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'install',
			title: 'Install the packages',
			headline: 'Install the packages',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Use a Svelte 5 / SvelteKit 3 application with Node.js 24 tooling. The spatial package is
				currently published on its beta channel. Install the libraries that your application imports
				directly:
			</p>
			<CodeBlock {...examples[0]} highlighted={data.highlights[0]} />
			<p>
				The spatial package uses Page Sections 0.6.0 and Three.js 0.187. Modern npm resolves peer
				dependencies; if you import Three.js directly, also declare <code>three@^0.187.0</code> and
				<code>@types/three@^0.187.0</code> for TypeScript.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'styles',
			title: 'Load the shared styles',
			headline: 'Load the shared styles',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Import the Page Sections stylesheet once in your root layout. The next chapter adds the
				shared theme, header and footer around your route content.
			</p>
			<CodeBlock {...examples[1]} highlighted={data.highlights[1]} />
		</div>
	</Section><Section
		section={{
			id: 'files',
			title: 'Supply your own files',
			headline: 'Supply your own files',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Models and environments are not bundled with the npm package. Put a GLB model, an HDR
				environment and a poster in your application's <code>static/assets/</code> directory. A GLB contains
				a model; an HDR provides environment lighting; a poster is a normal image used while loading and
				as a fallback.
			</p>
			<p>
				You can use the small generated assets in this repository's <a
					href="https://github.com/LauridBergjohann/spatial-elements/tree/main/apps/demo"
				>
					minimal demo
				</a>
				to start. In a repository checkout, <code>npm run assets:demo</code> generates them. Otherwise
				provide your own files.
			</p>
			<p>
				If your GLB uses Draco compression, serve the decoder files too and configure <a
					href="/docs/reference/components/#brand-stage-shell-draco-decoder-path"
				>
					<code>dracoDecoderPath</code>
				</a>
				on the shell. Uncompressed GLBs do not need that decoder.
				<a href="/docs/foundations/assets/">Models and element data</a> explains the required fields.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'next',
			title: 'Build in small steps',
			headline: 'Build in small steps',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Set up the <a href="/docs/foundations/page-shell/">shared layout</a>, define one
				<a href="/docs/foundations/assets/">element document</a>, then add a
				<a href="/docs/sections/composition/">ContentPage</a> with a CardGrid. A detail route comes after
				the collection works.
			</p>
		</div>
	</Section>
</WebsitePage>
