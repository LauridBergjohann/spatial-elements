<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.spatialElement}
	><Section
		section={{
			id: 'features',
			title: 'Features',
			headline: 'Features',
			background: { color: 'standard' }
		}}
		><h2>A closer look at {data.spatialElement.title}</h2>
		<p>
			Drag the model to rotate it. Hover over the main model to see its interaction outline, then
			use the wheel to zoom.
		</p></Section
	><Section
		section={{
			id: 'design',
			title: 'Design',
			headline: 'Design',
			background: { color: 'standard' }
		}}
		><h2>Original geometric studies</h2>
		<p>
			These assets are created procedurally for this demo and can be regenerated from the repository
			tooling.
		</p>
		<a href="/demo/categories/carousel">Back to the carousel</a></Section
	><!-- The shell scroll proof needs overflowing content, including in the 3XL pane. -->
	<Section
		section={{
			id: 'scroll-proof',
			title: 'Reading and theme continuity',
			background: { color: 'standard' }
		}}
	>
		<div style="min-height: 1200px">
			<h2>Reading and theme continuity</h2>
			<p>
				This isolated fixture keeps the document scrollable while the persistent menu and theme
				controls are exercised.
			</p>
		</div>
	</Section>
</SpatialElementPage>
