<script lang="ts">
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Documentation' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Documentation',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'overview',
			title: 'From HTML to spatial experiences',
			headline: 'From HTML to spatial experiences',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>
			Start with content and real links. Add models, a shared stage and spatial interactions as
			progressive enhancements. The chapter links below guide you from your first page to detailed
			API references.
		</p>
		<p>
			For ordinary content sections, see the <a href="https://page-sections.bergjohann.com/docs/"
				>Page Sections documentation</a
			>.
		</p></Section
	>
</WebsitePage>
