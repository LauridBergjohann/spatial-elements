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
				This page demonstrates Spatial Elements using a Rolex watch model. You cannot purchase
				products here. For official product and purchasing information, please visit <a
					href="https://www.rolex.com/">rolex.com</a
				>.
			</p>
			<p>
				The <a href="https://github.com/mrdoob/three.js/blob/master/examples/webgl_watch.html"
					>Three.js watch example</a
				> was a major inspiration for Spatial Elements. This showcase explores how that kind of visual
				experience can become part of a complete content-driven website.
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
		<p><a href="/showcase/watches/categories/list/">Return to the collection</a></p></Section
	>
</SpatialElementPage>
