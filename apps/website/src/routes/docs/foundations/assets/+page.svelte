<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
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
				The public procedural fixtures are reproducible and redistributable. Brand production
				sources, optimized outputs, comparison images and their provenance remain in the private
				application. See <a href="/docs/sections/composition/">authoring</a> for consumer
				configuration and
				<a
					href="https://github.com/LauridBergjohann/spatial-elements/blob/main/docs/migration-audit.md"
					>migration audit</a
				> for preservation of historical evidence.
			</p>
		</div></Section
	>
</WebsitePage>
