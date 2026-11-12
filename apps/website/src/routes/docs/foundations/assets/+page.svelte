<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [
		{
			language: 'sh',
			code: 'npm run assets:showcase\nnpm run assets:showcase:render\nnpm run assets:showcase:check\n'
		}
	];
</script>

<script lang="ts">
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Models and environments' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Models and environments',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'introduction',
			title: 'Introduction',
			headline: 'Introduction',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Sources of truth: <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/spatialElementAssets.ts"
					>element assets</a
				>,
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/spatialElementLodPair.ts"
					>LOD pairs</a
				>,
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/packages/core/src/catalog/assets/SpatialElementAssetManager.ts"
					>asset manager</a
				>.
			</p>
			<p>
				Logical element identity is independent of its URL, LOD or number of visible occurrences. An
				immutable resource request identifies format, URL, revision and decoder/extension
				requirements. Updating content at a stable URL therefore requires an appropriate revision
				change.
			</p>
			<p>
				Low and High must occupy a common authored reference frame, pivot and orientation. Do not
				independently center/normalize them: that would produce jumps during refinement. Verified
				manifests use a right-handed frame with +Y up, +Z front and metres. A provisional shared
				frame is supported, but it does not prove physical dimensions. Physical metadata needs
				documented provenance.
			</p>
			<p>
				A representation records its canonical transform, selected root, exclusions, material
				bindings and estimated costs. Posters provide the non-GPU presentation. Environment and
				decoder resources must be explicitly deployable by the host. An enum listing a decoder
				requirement is not a guarantee that every consumer has configured that decoder.
			</p>
			<p>
				Decoded source geometry/materials belong to the asset manager; live instances, local
				material clones and render targets belong to presentation owners. A retained capture pins
				its resources independently of DOM registration. CPU cache residency, live instance
				ownership and GPU preparation are distinct states. Disposal must respect those boundaries.
			</p>
			<p>
				Validation should cover frame compatibility, resource URLs/requirements, bounds, material
				assumptions, actual visual Low/High alignment and ownership after repeated navigation.
				Estimated texture/geometry bytes are useful budgets, not complete driver memory
				measurements.
			</p>
			<p>
				The procedural fixtures are reproducible and redistributable. The website also serves
				prepared product models and photographs for its <a href="/showcase/">public showcase</a>.
				These product assets have separate provenance and rights; they are not part of the package
				license. See <a href="/docs/sections/composition/">authoring</a> for consumer configuration
				and the <a href="/assets/ATTRIBUTION.md">asset attribution</a> for the website's media.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'showcase-pipeline',
			title: 'Preparing a product collection',
			headline: 'Preparing a product collection',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The showcase keeps the product description, photos, presentation pose and geometry manifests
				separate. One product ID joins them together. Generated assets live in
				<code>apps/website/static/assets/showcase/&lt;product-id&gt;/</code>; source assets remain
				outside the published static directory.
			</p>
			<p>
				Each model has a low-detail variant for category grids, carousels and minimaps, and a
				higher-detail variant for the product view. Simplification preserves their common frame and
				reuses the source's materials, textures and normal maps where present. Texture resizing and
				material consolidation reduce work as well as triangle counts. This pipeline does not
				automatically bake arbitrary geometric detail into new normal maps.
			</p>
			<p>
				Fallback images use the same authored model pose and camera orientation as the detail view.
				The transparent 1024 × 1024 WebP remains useful while the interactive model loads, without
				JavaScript or on a browser without WebGPU. Supplied photographs are converted to WebP
				without upscaling, with a 1600-pixel maximum edge and smaller 640-pixel alternatives for
				responsive galleries and media selectors.
			</p>
			<CodeBlock
				code={examples[0].code}
				language={examples[0].language}
				highlighted={data.highlights[0]}
			/>
			<p>
				Run these commands from the repository root. Generation needs the source collection; poster
				rendering also needs a browser with WebGPU. The committed outputs are sufficient to build
				the website. The <a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/tooling/asset-pipeline/README.md"
					>asset pipeline instructions</a
				> describe the inputs, commands and quality checks. Inspect silhouettes, materials and Low/High
				alignment alongside the generated resource reports before publishing a new model.
			</p>
		</div>
	</Section>
</WebsitePage>
