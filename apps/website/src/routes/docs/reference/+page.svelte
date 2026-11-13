<script lang="ts">
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section, CodeBlock } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Reference' }} showContentMenu>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: 'Reference',
			headingLevel: 1,
			headingSize: 'm',
			background: { color: 'standard', size: 'standard' }
		}}
	/>
	<Section
		section={{
			id: 'overview',
			title: 'In this chapter',
			headline: 'In this chapter',
			background: { color: 'standard', size: 'standard' }
		}}><p>Follow the topics below in order, or choose the part you need.</p></Section
	>
</WebsitePage>
