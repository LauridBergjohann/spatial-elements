<script lang="ts">
	import {
		ContentPage,
		SpatialCardGridSection,
		SpatialCarouselSection
	} from '@spatial-elements/sveltekit';
	import { HeadingSection, ImageSection } from '@page-sections/svelte';
	import SquareArrowRightExit from '@lucide/svelte/icons/square-arrow-right-exit';
	import { showcaseHdr } from '#lib/showcase/optimized.ts';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<ContentPage
	hdr={showcaseHdr}
	page={{
		title: data.segment.title,
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: data.segment.title }]
	}}
>
	<HeadingSection
		section={{
			id: 'page-heading',
			title: data.segment.title,
			headingLevel: 1,
			introduction: data.segment.id === 'industrial' ? undefined : data.segment.description
		}}
	/>
	{#if data.segment.id !== 'exclusive'}
		<SpatialCarouselSection
			section={{
				id: data.segment.id === 'industrial' ? 'example-products' : 'new-products',
				title: data.segment.id === 'industrial' ? 'Example Products' : 'New products',
				headline: data.segment.id === 'industrial' ? undefined : 'New products',
				background: { color: 'transparent', size: 'full' }
			}}
			list={data.highlights}
		/>
	{/if}
	{#if data.segment.id === 'industrial'}
		{#each data.brands as brand (brand.id)}
			<ImageSection
				section={{
					id: brand.id + '-introduction',
					title: brand.name,
					headline: brand.headline,
					imageSide: 'right',
					description: brand.description,
					image: {
						src: brand.image,
						alt: brand.alt,
						aspect: 'none',
						width: brand.width,
						height: brand.height
					},
					background: { color: 'standard', size: 'standard' }
				}}
			>
				<a class="company-link" href={brand.href} rel="external">
					Discover {brand.name}<SquareArrowRightExit size={20} aria-hidden="true" />
				</a>
			</ImageSection>
			<SpatialCardGridSection
				section={{
					id: brand.id + '-products',
					title: brand.name + ' products'
				}}
				list={brand.items}
				cardSize="m"
				cardTone="standard"
				mediaAspect="3/2"
			/>
		{/each}
	{:else}
		<SpatialCardGridSection
			section={{ id: 'collection', title: 'The collection', headline: 'The collection' }}
			list={data.items}
			cardSize={data.segment.cardSize}
			cardTone="standard"
			mediaAspect="3/2"
		/>
	{/if}
</ContentPage>

<style>
	.company-link {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 1rem;
	}
</style>
