<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';

	import DocFigure from '#lib/docs/DocFigure.svelte';
</script>

<WebsitePage page={{ title: 'Documentation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Documentation',
			introduction:
				'Build your understanding one step at a time: familiar HTML, shared layouts, spatial collections, then detailed experiences.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'start-here',
			title: 'Start with a website',
			headline: 'Start with a website',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				Spatial Elements is a SvelteKit library for presenting 3D objects alongside ordinary website
				content. A <strong>section</strong> is one meaningful part of a page: an introduction, a
				group of cards or a story. A <strong>stage</strong> is the shared rendering layer that brings
				models into those sections.
			</p>
			<p>
				You do not need to manage a Three.js scene to build your first collection. Begin with <a
					href="/docs/foundations/page-sections/"
				>
					the relationship to Page Sections
				</a>, then follow <strong>Next</strong> at the bottom of each page. The examples assume basic
				HTML, Svelte and SvelteKit knowledge.
			</p>
			<DocFigure
				name="foundations"
				alt="Page Sections supplies content layout; Spatial Elements adds a shared 3D stage. Both contribute to one page."
				caption="Build readable content first. Spatial rendering enhances the same pages and links."
			/>
		</div>
	</Section><Section
		section={{
			id: 'learning-path',
			title: 'Your learning path',
			headline: 'Your learning path',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<ol>
				<li>
					<a href="/docs/foundations/">Foundations</a> — Understand the shared foundation, install the
					packages and divide responsibilities between layout and page files.
				</li>
				<li>
					<a href="/docs/sections/">Content pages</a> — Compose sections, arrange a CardGrid and present
					selected objects in a Carousel.
				</li>
				<li>
					<a href="/docs/detail-pages/">Detail pages</a> — Combine a model, summary, media and a connected
					story. Learn how scrolling and ultrawide layouts work.
				</li>
				<li>
					<a href="/docs/interaction/">Appearance and interaction</a> — Coordinate themes, help texts
					and optional device orientation.
				</li>
				<li>
					<a href="/docs/advanced/">Advanced</a> — Explore persistent navigation, transitions and rendering
					budgets.
				</li>
				<li>
					<a href="/docs/reference/">Reference</a> — Inspect component properties, data objects and exact
					layout tokens.
				</li>
			</ol>
		</div>
	</Section><Section
		section={{
			id: 'explore',
			title: 'Learn by changing something',
			headline: 'Learn by changing something',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				The CardGrid and Carousel chapters contain working examples with matching source. The <a
					href="/docs/examples/"
				>
					example gallery
				</a>
				explores grids, surfaces and detail behavior. The <a href="/showcase/">showcase</a> combines them
				into complete experiences.
			</p>
			<p>
				Linked property names lead to their definitions. Object fields such as <a
					href="/docs/reference/types/#spatial-element-data-geometry"
				>
					<code>geometry</code>
				</a> lead to a field table, with further links to nested shapes. Code blocks remain copyable examples.
			</p>
		</div>
	</Section>
</WebsitePage>
