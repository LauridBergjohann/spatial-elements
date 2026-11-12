import { error } from '@sveltejs/kit';
import { showcaseElements as elements } from '$lib/showcase/collection';
import { showcaseProducts } from '$lib/showcase/products';
export const entries = () => elements.map((element) => ({ id: element.id }));
export function load({ params }: { params: { id: string } }) {
	const element = elements.find((item) => item.id === params.id);
	const product = showcaseProducts.find((item) => item.id === params.id);
	if (!element || !product) error(404, 'Element not found');
	return { element, product };
}
