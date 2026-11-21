<script module lang="ts">
	export const examples = [];
</script>

<script lang="ts">
	import WebsitePage from '#lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Foundations' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Foundations',
			introduction: 'Understand the pieces before composing your first spatial page.',
			headingLevel: 1,
			headingSize: 'l',
			background: { color: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'before-you-build',
			title: 'What you will learn',
			headline: 'What you will learn',
			background: { color: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				First, learn what Spatial Elements shares with Page Sections. Next, install the packages and
				create one persistent layout. Then prepare an element document — the title, model and media
				for a single object — and learn how the responsive layout uses available space.
			</p>
			<p>
				By the end of this chapter you will know which information belongs to the website, which
				belongs to a route and which belongs to a model.
			</p>
			<p>
				<a href="/docs/foundations/page-sections/">
					Begin with Page Sections and Spatial Elements →
				</a>
			</p>
		</div>
	</Section>
</WebsitePage>
