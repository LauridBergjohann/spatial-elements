<script lang="ts">
	import { SpatialElementPage, Section } from '@spatial-elements/sveltekit';
	import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right';
	import Play from 'lucide-svelte/icons/play';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<SpatialElementPage spatialElement={data.element}>
	<Section
		section={{
			id: 'product',
			title: 'About the product',
			headline: data.product.title,
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>{data.product.description}</p>
			<p>
				<a class="manufacturer-link" href={data.product.sourceUrl}
					>Product information from {data.product.manufacturer.name}<ArrowUpRight size={16} /></a
				>
			</p>
		</div>
	</Section>

	<Section
		section={{
			id: 'explore',
			title: 'Explore the details',
			headline: 'Take a closer look',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				This sample product story connects the interactive view with ordinary page content. Try
				rotating the model, selecting a photograph and returning to the 3D view.
			</p>
			<ul>
				{#each data.product.features as feature}<li>{feature}</li>{/each}
			</ul>
			<p>
				Use the section menu to move between this introduction, the available media and the
				demonstration notes. The model and its controls remain part of the same page.
			</p>
		</div>
	</Section>

	{#if data.product.photos.length}
		<Section
			section={{
				id: 'photographs',
				title: 'Product photographs',
				headline: 'From every angle',
				background: { color: 'standard', size: 'standard' }
			}}
		>
			<div class="product-gallery">
				{#each data.product.photos as photo (photo.id)}
					<figure>
						<a href={photo.src} aria-label={`Open image: ${photo.label}`}>
							<img
								src={photo.src}
								srcset={photo.small.src !== photo.src
									? `${photo.small.src} ${photo.small.width}w, ${photo.src} ${photo.width}w`
									: undefined}
								sizes="(max-width: 600px) 90vw, (max-width: 1100px) 44vw, 560px"
								width={photo.width}
								height={photo.height}
								alt={photo.alt}
								loading="lazy"
								decoding="async"
							/>
						</a>
						<figcaption>{photo.label}</figcaption>
					</figure>
				{/each}
			</div>
		</Section>
	{/if}

	{#if data.product.video}
		<Section
			section={{
				id: 'video',
				title: 'Product video',
				headline: 'See it in use',
				background: { color: 'standard', size: 'standard' }
			}}
		>
			<a class="video-link" href={data.product.video.href}>
				{#if data.product.video.poster}
					<img
						src={data.product.video.poster.src}
						width={data.product.video.poster.width}
						height={data.product.video.poster.height}
						alt={data.product.video.poster.alt}
						loading="lazy"
						decoding="async"
					/>
				{/if}
				<span><Play size={20} />Watch {data.product.video.label} on YouTube</span>
			</a>
			<p class="video-note">
				You can also select the video beside the 3D view. The embedded player loads only when
				selected.
			</p>
		</Section>
	{/if}

	<Section
		section={{
			id: 'demo-notice',
			title: 'About this demonstration',
			headline: 'A demonstration, not a shop',
			background: { color: 'standard', size: 'standard' }
		}}
	>
		<div class="prose">
			<p>
				This independent showcase demonstrates Spatial Elements using a model from the
				{data.product.manufacturer.name} collection. You cannot purchase products here. For official product
				and purchasing information, please visit
				<a href={data.product.manufacturer.href}>{data.product.manufacturer.domain}</a>.
			</p>
			{#if data.element.id === 'chronograph'}
				<p>
					The <a href="https://github.com/mrdoob/three.js/blob/master/examples/webgl_watch.html"
						>Three.js watch example</a
					> was a major inspiration for Spatial Elements. This showcase explores how that kind of visual
					experience can become part of a complete content-driven website.
				</p>
			{/if}
			<p>
				Rotate and zoom the model to explore its form and materials. Its image remains visible while
				the interactive view loads, or when interactive rendering is unavailable.
			</p>
			<p><a href="/showcase/">Return to the collection</a></p>
		</div>
	</Section>
</SpatialElementPage>

<style>
	.manufacturer-link,
	.video-link span {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.product-gallery {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: 1.5rem;
	}
	figure {
		margin: 0;
		min-width: 0;
	}
	figure a {
		display: grid;
		place-items: center;
		aspect-ratio: 3 / 2;
		border-radius: var(--ps-radius, 12px);
		background: var(--ps-section-muted);
		overflow: hidden;
	}
	figure img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	figcaption {
		margin-block-start: 0.75rem;
		color: var(--ps-body);
		font-size: 0.875rem;
	}
	.video-link {
		display: block;
		max-width: 48rem;
	}
	.video-link img {
		display: block;
		width: 100%;
		height: auto;
		max-height: 28rem;
		object-fit: contain;
		background: var(--ps-section-muted);
		border-radius: var(--ps-radius, 12px);
		margin-block-end: 1rem;
	}
	.video-note {
		color: var(--ps-body);
		font-size: 0.875rem;
		margin-block-start: 1rem;
	}
</style>
