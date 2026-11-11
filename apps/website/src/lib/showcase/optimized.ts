import assets from './assets.json';
import { geometryFromLodPair, type SpatialElementLodPair } from '@spatial-elements/core';
import type { SpatialElementData } from '@spatial-elements/sveltekit';
export function optimizedSpatialElements(
	brand: string,
	elements: readonly SpatialElementData[]
): readonly SpatialElementData[] {
	return elements.map((element) => {
		const asset = assets.find(
			(item) => item.brandId === brand && item.spatialElementId === element.id
		);
		if (!asset) throw new Error('Missing showcase assets: ' + brand + '/' + element.id);
		return {
			...element,
			brandId: 'showcase',
			pageTitle: element.title + ' | Spatial Elements',
			eyebrow: 'Demonstration · ' + (brand === 'wera' ? 'Wera' : 'Rolex'),
			geometry: geometryFromLodPair(asset.pair as unknown as SpatialElementLodPair),
			fallbackImage: asset.poster.src,
			fallbackImageSize: [asset.poster.width, asset.poster.height],
			action: {
				label: brand === 'wera' ? 'Visit Wera — not sold here' : 'Visit Rolex — not sold here',
				href: brand === 'wera' ? 'https://www.wera.de/' : 'https://www.rolex.com/'
			},
			breadcrumbs: [{ label: 'Showcase', href: '/showcase/' }, { label: element.title }]
		};
	});
}
