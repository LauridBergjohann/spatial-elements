<script lang="ts">
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { HeadingSection, Section } from '@page-sections/svelte';
</script>

<WebsitePage page={{ title: 'Interactive layouts' }}
	><HeadingSection
		section={{ id: 'page-heading', title: 'Explore the layouts', headingLevel: 1 }}
	/><Section
		section={{
			id: 'guide',
			title: 'Try it in your browser',
			headline: 'Try it in your browser',
			background: { color: 'standard', size: 'standard' }
		}}
		><p>
			Resize the viewport, change the card settings and scroll the detail pages. These focused
			examples demonstrate container grids, surfaces, docking, media and the reading pane.
		</p></Section
	></WebsitePage
>
