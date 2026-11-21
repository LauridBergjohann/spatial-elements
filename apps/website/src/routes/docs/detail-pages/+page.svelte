<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Detail pages' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Detail pages',
			introduction: 'Bring one object, its media and its story together in a connected page.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'anatomy',
			title: 'From collection to detail',
			headline: 'From collection to detail',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				A detail page focuses on one element. <a
					href="/docs/reference/components/#spatial-element-page"
				>
					<code>SpatialElementPage</code>
				</a>
				receives the original
				<a href="/docs/reference/types/#spatial-element-data"><code>SpatialElementData</code></a> document.
				It places the model beside a summary, provides media selection and connects your content sections
				through navigation.
			</p>
			<DocFigure
				name="detail-layout"
				alt="A regular detail page stacks model, summary and sections; an ultrawide page places a reading pane beside the model."
				caption="The composition changes with available space. The content and document scrolling remain connected."
			/>
		</div>
	</Section><Section
		section={{
			id: 'learn-the-pieces',
			title: 'Build up the experience',
			headline: 'Build up the experience',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<ol>
				<li>
					<a href="/docs/detail-pages/structure/">Structure and sections</a> — Resolve an element, add
					its story and let sections create navigation.
				</li>
				<li>
					<a href="/docs/detail-pages/summaries/">Summary and actions</a> — Start with data-driven features,
					then share interactive controls when needed.
				</li>
				<li>
					<a href="/docs/detail-pages/media/">Media and controls</a> — Add images, video and model controls.
				</li>
				<li>
					<a href="/docs/detail-pages/responsive-layout/">Scrolling and ultrawide layouts</a> — Understand
					docking, the reading pane and the shared footer.
				</li>
				<li>
					<a href="/docs/detail-pages/accessibility/">Fallback and accessibility</a> — Keep the experience
					usable across devices and input methods.
				</li>
			</ol>
			<p>
				<a href="/showcase/consumer/logitech-brio-500/">
					Explore a complete detail page: Brio 500 →
				</a>
			</p>
		</div>
	</Section>
</WebsitePage>
