<script lang="ts">
	import { HeadingSection, CardGridSection } from '@page-sections/svelte';
	import WebsitePage from '$lib/WebsitePage.svelte';
</script>

<WebsitePage page={{ title: 'Showcase' }}
	><HeadingSection
		section={{
			id: 'page-heading',
			title: 'Objects with a story',
			headingLevel: 1,
			introduction:
				'Interactive demonstrations built with Spatial Elements. These are examples, not shops.'
		}}
	/><CardGridSection
		section={{
			id: 'collections',
			title: 'Explore the collections',
			headline: 'Explore the collections'
		}}
		cardTone="muted"
		list={[
			{
				id: 'wera',
				title: 'Wera tools',
				description: 'Eight tools, three collection layouts and individual detail pages.',
				href: '/showcase/wera/',
				image: { src: '/assets/posters/wera-tool-check-plus.png', alt: 'Wera tool set' }
			},
			{
				id: 'watch',
				title: 'The watch',
				description: 'A Rolex geometry study inspired by the Three.js watch example.',
				href: '/showcase/watches/',
				image: { src: '/assets/posters/watches-chronograph.png', alt: 'Watch' }
			}
		]}
	/></WebsitePage
>
