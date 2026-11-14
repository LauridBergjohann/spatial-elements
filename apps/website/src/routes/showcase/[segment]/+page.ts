import { error } from '@sveltejs/kit';
import { showcaseSegments } from '$lib/showcase/segments';
import { showcaseProducts } from '$lib/showcase/products';
import { showcaseItems } from '$lib/showcase/collection';
import { industrialBrands, industrialHighlights } from '$lib/showcase/industrial';
export const entries = () => showcaseSegments.map((segment) => ({ segment: segment.id }));
export function load({ params }: { params: { segment: string } }) {
	const segment = showcaseSegments.find((item) => item.id === params.segment);
	if (!segment) error(404, 'Collection not found');
	const ids = new Set(
		showcaseProducts
			.filter((product) => product.segment.id === segment.id)
			.map((product) => product.id)
	);
	const items = showcaseItems.filter((item) => ids.has(item.id));
	return {
		segment,
		items,
		highlights:
			segment.id === 'industrial'
				? industrialHighlights.map((id) => items.find((item) => item.id === id)!)
				: items.slice(0, 3),
		brands:
			segment.id === 'industrial'
				? industrialBrands.map((brand) => ({
						...brand,
						items: items.filter((item) =>
							showcaseProducts.some(
								(product) => product.id === item.id && product.manufacturerId === brand.id
							)
						)
					}))
				: []
	};
}
