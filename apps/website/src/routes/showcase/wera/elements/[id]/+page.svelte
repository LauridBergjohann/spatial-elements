<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.element}>
	<Section
		section={{
			id: 'demo-notice',
			title: 'About this demonstration',
			headline: 'A demonstration, not a shop',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				This page demonstrates Spatial Elements using Wera tools. You cannot purchase products here.
				For official product and purchasing information, please visit <a href="https://www.wera.de/"
					>wera.de</a
				>.
			</p>
		</div></Section
	>
	<Section
		section={{
			id: 'explore',
			title: 'Explore the model',
			headline: 'Look closer',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>
			Rotate and zoom the model to explore its form and materials. When interactive rendering is
			unavailable, the poster image and page content remain accessible.
		</p>
		<p><a href="/showcase/wera/categories/list/">Return to the collection</a></p></Section
	>
</SpatialElementPage>
