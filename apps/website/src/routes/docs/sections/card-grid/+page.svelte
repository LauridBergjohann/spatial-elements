<script module lang="ts">
	export const examples: Array<{ language: string; code: string }> = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
	import CollectionExample from '#lib/docs/CollectionExample.svelte';
</script>

<WebsitePage page={{ title: 'Spatial CardGrid' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Spatial CardGrid',
			introduction: 'Help visitors compare objects in a responsive grid of linked cards.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'how-it-works',
			title: 'Cards on the shared content grid',
			headline: 'Cards on the shared content grid',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#spatial-card-grid-section">
					<code>SpatialCardGridSection</code>
				</a>
				takes a
				<a href="/docs/reference/components/#spatial-card-grid-section-section">
					<code>section</code>
				</a>
				object and a
				<a href="/docs/reference/components/#spatial-card-grid-section-list"><code>list</code></a>
				of <a href="/docs/reference/types/#spatial-list-item"><code>SpatialListItem</code></a> objects.
				It uses Page Sections' ContentGrid and cards, with spatial models fitted into their media frames.
			</p>
			<p>
				Every card is one native link, including its image. An eyebrow keeps the accent color; the
				title uses normal text color. A description appears when supplied. Cards have equal heights,
				and description text never exceeds the title's size.
			</p>
			<p>
				Use each element's <a href="/docs/reference/types/#spatial-element-data-grid-view">
					<code>gridView</code>
				</a>
				to set a separate
				<a href="/docs/reference/types/#spatial-collection-pose">
					<code>SpatialCollectionPose</code>
				</a>
				for the live card model. Its angles are in degrees and its scale multiplies the automatic fit.
				This leaves the carousel pose and detail camera independent. See
				<a href="/docs/sections/carousel/#model-poses">independent model poses</a> for the shared fields.
			</p>
			<DocFigure
				name="collections"
				alt="A CardGrid makes all items visible for comparison, while a Carousel emphasizes one at a time."
				caption="Use a grid for browsing and comparing a collection."
			/>
		</div>
	</Section><Section
		section={{
			id: 'settings',
			title: 'Choose size and media framing',
			headline: 'Choose size and media framing',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#spatial-card-grid-section-card-size">
					<code>cardSize</code>
				</a>
				accepts <code>s</code>, <code>m</code> or <code>l</code>. The grid chooses suitable spans as
				its container changes. Leave
				<a href="/docs/reference/components/#spatial-card-grid-section-item-span">
					<code>itemSpan</code>
				</a> unset unless you need explicit column allocation.
			</p>
			<p>
				<a href="/docs/reference/components/#spatial-card-grid-section-media-aspect">
					<code>mediaAspect</code>
				</a>
				chooses the media frame: square, 3:2 or 4:3. Spatial cards default to square and
				<a href="/docs/reference/components/#spatial-card-grid-section-media-fit">
					<code>mediaFit</code>
				</a> defaults to contain, so the full object fits. The text below the frame has its own height.
			</p>
			<p>
				<a href="/docs/reference/components/#spatial-card-grid-section-card-tone">
					<code>cardTone</code>
				</a>
				selects a standard or muted surface.
				<a href="/docs/reference/components/#spatial-card-grid-section-card-shadow">
					<code>cardShadow</code>
				</a>
				adds a resting shadow; hover and keyboard focus provide a highlight even without one. These are
				component properties, not fields inside
				<a href="/docs/reference/components/#spatial-card-grid-section-section">
					<code>section</code>
				</a>.
			</p>
			<p>
				<a href="/docs/reference/types/#spatial-card-grid-options">
					Inspect every CardGrid option →
				</a>
			</p>
		</div>
	</Section><CollectionExample kind="grid" /><Section
		section={{
			id: 'real-collection',
			title: 'A complete collection',
			headline: 'A complete collection',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				See the <a href="/showcase/workbench/">Workbench collection</a> for model cards with real
				product content. For filtering, repeated elements and explicit spans, open
				<a href="/docs/examples/cards/">Card layouts</a>.
			</p>
			<p>
				Keep stable IDs when reordering. Use a distinct <a
					href="/docs/reference/types/#spatial-list-item-item-key"
				>
					<code>itemKey</code>
				</a> if the same element occurs more than once within the section. Supply posters so the collection
				remains useful before rendering starts.
			</p>
		</div>
	</Section>
</WebsitePage>
