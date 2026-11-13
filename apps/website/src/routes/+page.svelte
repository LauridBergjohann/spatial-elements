<script lang="ts">
	import { HeroSection, Section, CardGridSection } from '@page-sections/svelte';
	import WebsitePage from '$lib/WebsitePage.svelte';
	import { SpatialCarouselSection } from '@spatial-elements/sveltekit';
	import { featuredItems } from '$lib/showcase/collection';
	import { showcaseHdr } from '$lib/showcase/optimized';
</script>

<WebsitePage
	hdr={showcaseHdr}
	page={{ title: 'Spatial Elements — content with another dimension' }}
>
	<HeroSection
		section={{
			id: 'welcome',
			title: 'Spatial Elements',
			headline: 'Give your content another dimension.',
			eyebrow: 'Spatial Elements · SvelteKit',
			headingLevel: 1,
			composition: 'artwork',
			textBackground: false,
			introduction:
				'Build interactive 3D collections and detail pages around real content. Shared layouts, persistent rendering and ordinary HTML bring models and stories together.',
			image: {
				src: '/assets/showcase/chronograph/chronograph-poster.webp',
				alt: 'A watch from the spatial showcase',
				width: 1024,
				height: 1024
			},
			actions: [
				{ label: 'Get started', href: '/getting-started/', variant: 'primary' },
				{ label: 'Explore the showcase', href: '/showcase/', variant: 'text' }
			]
		}}
	/>
	<Section
		section={{
			id: 'what-is-spatial-elements',
			title: 'What is Spatial Elements?',
			headline: 'A website first. A spatial experience when it can be.',
			background: { color: 'standard', size: 'standard' }
		}}
		><div class="prose">
			<p>
				Spatial Elements is a SvelteKit library for presenting models alongside text, images and
				links. Use it for product demonstrations, collections and visual stories. Page Sections
				supplies the shared content layout; Three.js and WebGPU add the spatial layer.
			</p>
			<p>
				Visitors can explore a model, open its detail page and return to the collection. Meaningful
				HTML, real links and supplied poster images keep the content available when JavaScript or
				WebGPU is unavailable.
			</p>
		</div></Section
	>
	<SpatialCarouselSection
		section={{
			id: 'featured-products',
			title: 'Explore selected products',
			background: { color: 'transparent', size: 'full' }
		}}
		list={featuredItems}
	/>
	<CardGridSection
		section={{
			id: 'features',
			title: 'Why Spatial Elements?',
			headline: 'The pieces work together.'
		}}
		cardTone="muted"
		list={[
			{
				id: 'content',
				title: 'Content and 3D together',
				description:
					'Compose spatial cards, carousels and detail views with the same responsive sections as the rest of your website.',
				href: '/docs/sections/composition/'
			},
			{
				id: 'stage',
				title: 'A persistent stage',
				description: 'Keep a shared renderer and its resources alive across related pages.',
				href: '/docs/advanced/navigation/'
			},
			{
				id: 'fallback',
				title: 'A readable fallback',
				description: 'Deliver HTML and poster images before adding interactive rendering.',
				href: '/docs/foundations/first-experience/'
			},
			{
				id: 'assets',
				title: 'Assets under your control',
				description: 'Use your own GLB models, environments and levels of detail.',
				href: '/docs/foundations/assets/'
			},
			{
				id: 'themes',
				title: 'Your visual identity',
				description: 'Coordinate content surfaces, spatial materials and light or dark themes.',
				href: '/docs/interaction/themes/'
			},
			{
				id: 'try',
				title: 'Explore as you learn',
				description: 'Try layout options and copy the corresponding code.',
				href: '/docs/sections/playground/'
			}
		]}
	/>
</WebsitePage>
