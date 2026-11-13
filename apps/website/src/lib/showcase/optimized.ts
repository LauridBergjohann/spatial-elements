import assets from './geometry-assets.json';
import presentations from './presentation.json';
import { geometryFromLodPair, type SpatialElementLodPair } from '@spatial-elements/core';
import type { SpatialElementData } from '@spatial-elements/sveltekit';
import type { ShowcaseProduct } from './products';

/** Shared by the product pages, category cards and the offline poster renderer. */
export const showcaseHdr = '/assets/environments/studio.hdr';

export function optimizedSpatialElement(product: ShowcaseProduct): SpatialElementData {
	const asset = assets.find((item) => item.spatialElementId === product.id);
	if (!asset) throw new Error('Missing showcase assets: ' + product.id);
	const presentation = presentations[product.id as keyof typeof presentations] as Pick<
		SpatialElementData,
		'model' | 'camera' | 'minimap'
	>;
	return {
		...presentation,
		id: product.id,
		brandId: 'showcase',
		title: product.title,
		pageTitle: product.title + ' | Spatial Elements',
		eyebrow: product.manufacturer.name + ' · Demonstration',
		features: product.features.map((label) => ({ label, marker: '•' })),
		hdr: showcaseHdr,
		geometry: geometryFromLodPair(asset.pair as unknown as SpatialElementLodPair),
		fallbackImage: `/assets/showcase/${product.id}/${product.id}-poster.webp`,
		fallbackImageSize: [1024, 1024],
		action: {
			label: `Visit ${product.manufacturer.name} — not sold here`,
			href: product.sourceUrl
		},
		breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: product.title }],
		media: [
			{ id: 'three-dimensional-view', kind: 'minimap', label: 'Interactive 3D view' },
			...product.photos.map((photo) => ({
				id: photo.id,
				kind: 'image' as const,
				label: photo.label,
				src: photo.src,
				thumbnail: photo.small.src,
				fit: photo.fit as 'contain' | 'cover',
				alt: photo.alt
			})),
			...(product.video
				? [
						{
							id: 'product-video',
							kind: 'youtube' as const,
							label: product.video.label,
							videoId: product.video.id,
							poster: product.video.poster?.small.src
						}
					]
				: [])
		]
	};
}
