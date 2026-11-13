import { error } from '@sveltejs/kit';
import { showcaseElements } from '$lib/showcase/collection';
import { showcaseProducts } from '$lib/showcase/products';
export const entries = () =>
	showcaseProducts.map((product) => ({ segment: product.segment.id, id: product.id }));
export function load({ params }: { params: { segment: string; id: string } }) {
	const product = showcaseProducts.find(
		(item) => item.id === params.id && item.segment.id === params.segment
	);
	const element = showcaseElements.find((item) => item.id === params.id);
	if (!product || !element) error(404, 'Product not found');
	return { product, element };
}
