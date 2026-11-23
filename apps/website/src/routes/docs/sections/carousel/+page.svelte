<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
	import CollectionExample from '#lib/docs/CollectionExample.svelte';
</script>

<WebsitePage page={{ title: 'Spatial Carousel' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Spatial Carousel',
			introduction:
				'Let visitors focus on one object while keeping the rest of the collection within reach.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'focus',
			title: 'One selected object',
			headline: 'One selected object',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#spatial-carousel-section">
					<code>SpatialCarouselSection</code>
				</a>
				uses the same
				<a href="/docs/reference/types/#spatial-list-item"><code>SpatialListItem</code></a> data as the
				CardGrid. It emphasizes the selected model and its summary, with neighbouring models available
				through selection, arrows and dragging. The summary title and eyebrow link to the detail page.
				On XS and S screens, the whole compact summary is a link. It sits below the model with a slight
				overlap, between the two arrows; the selection dots have their own space underneath. Drag empty
				space in either summary layout to move the carousel; drag over text to select it.
			</p>
			<DocFigure
				name="collections"
				alt="The carousel centers attention on one model and its summary, while neighbouring models remain accessible."
				caption="Use a carousel for a featured selection, and a CardGrid when visitors need an overview."
			/>
		</div>
	</Section><Section
		section={{
			id: 'selection',
			title: 'Selection and presentation',
			headline: 'Selection and presentation',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				<a href="/docs/reference/components/#spatial-carousel-section-initial-item-key">
					<code>initialItemKey</code>
				</a>
				chooses the starting item, using
				<a href="/docs/reference/types/#spatial-list-item-item-key"><code>itemKey</code></a>
				when present and otherwise
				<a href="/docs/reference/types/#spatial-list-item-id"><code>id</code></a>. It is an initial
				preference, not a controlled selected-value property.
				<a href="/docs/reference/components/#spatial-carousel-section-onselectionchange">
					<code>onselectionchange</code>
				</a> reports the selected occurrence key and element ID.
			</p>
			<p>
				<a href="/docs/reference/components/#spatial-carousel-section-presentation">
					<code>presentation</code>
				</a>
				accepts optional
				<a href="/docs/reference/types/#carousel-presentation-radius"><code>radius</code></a>
				and <a href="/docs/reference/types/#carousel-presentation-depth"><code>depth</code></a> controls.
				These change the arrangement, not the model's authored scale or its asset URLs. The default framing
				is suitable for a first collection. Wider screens use a larger turntable radius. Distant models
				soften and fade as complete silhouettes, without revealing surfaces inside the model.
			</p>
			<p>
				The <a href="/docs/reference/types/#spatial-list-item-summary"><code>summary</code></a> on a
				list item provides feature labels and an optional action. The later
				<a href="/docs/detail-pages/summaries/">summary chapter</a> explains how to share richer interactive
				content with the detail page.
			</p>
		</div>
	</Section><Section
		section={{
			id: 'model-poses',
			title: 'Independent model poses',
			headline: 'Independent model poses',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Set <a href="/docs/reference/types/#spatial-element-data-carousel-view">
					<code>carouselView</code>
				</a>
				on each element to orient it independently of its detail camera. The
				<a href="/docs/reference/types/#spatial-collection-pose">
					<code>SpatialCollectionPose</code>
				</a>
				fields are
				<a href="/docs/reference/types/#spatial-collection-pose-azimuth"><code>azimuth</code></a>
				and
				<a href="/docs/reference/types/#spatial-collection-pose-elevation">
					<code>elevation</code>
				</a>
				in degrees, plus a positive
				<a href="/docs/reference/types/#spatial-collection-pose-scale"><code>scale</code></a> multiplier.
				Start with both angles at 0 and scale at 1 to stand the imported model upright. The carousel fits
				its lowest supporting points to the shared floor.
			</p>
			<p>
				The showcase stores these values in <code>presentation.json</code>, alongside the
				independent
				<a href="/docs/reference/types/#spatial-element-data-grid-view"><code>gridView</code></a>
				pose and detail
				<a href="/docs/reference/types/#spatial-element-data-camera"><code>camera</code></a>. If a
				collection angle is omitted, it retains the detail camera angle for compatibility. Posters
				remain authored images; these poses affect live models.
			</p>
			<p>
				The carousel uses a viewport-based height budget with a fixed allowance for the page header,
				breadcrumbs, a typical page title and a preview of the next section. Its own heading shares
				this budget. Other sections and introduction lengths do not affect its size, and scrolling
				does not resize it. Neighbouring models remain opaque; only the far end of the turntable
				fades out.
			</p>
		</div>
	</Section><CollectionExample kind="carousel" /><Section
		section={{
			id: 'fallback',
			title: 'A useful carousel without WebGPU',
			headline: 'A useful carousel without WebGPU',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				When spatial rendering is unavailable, the same section offers a native horizontal
				scroll-snap collection with poster images, labels and links. The spatial carousel owns this
				fallback; it does not wrap the separate 2D Page Sections Carousel component.
			</p>
			<p>
				Try keyboard navigation and a narrow window as well as the enhanced view. For a complete
				product experience, explore <a href="/showcase/consumer/">Consumer</a> and open an item from its
				featured carousel.
			</p>
		</div>
	</Section>
</WebsitePage>
