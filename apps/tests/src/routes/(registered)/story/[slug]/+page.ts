import { error } from '@sveltejs/kit';
import { spatialElements } from '$lib/catalog';
export const entries = () => spatialElements.slice(0, 3).map((element) => ({ slug: element.id }));
export function load({ params }: { params: { slug: string } }) {
	const element = spatialElements.find((item) => item.id === params.slug);
	if (!element) error(404, 'Unknown element');
	return { element };
}
