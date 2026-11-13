import { error } from '@sveltejs/kit';
import { showcaseSegments } from '$lib/showcase/segments';
import { showcaseProducts } from '$lib/showcase/products';
import { showcaseItems } from '$lib/showcase/collection';
export const entries = () => showcaseSegments.map((segment) => ({ segment: segment.id }));
export function load({ params }: { params: { segment: string } }) {
	const segment = showcaseSegments.find((item) => item.id === params.segment);
	if (!segment) error(404, 'Collection not found');
	const ids = new Set(
		showcaseProducts
			.filter((product) => product.segment.id === segment.id)
			.map((product) => product.id)
	);
	return { segment, items: showcaseItems.filter((item) => ids.has(item.id)) };
}
