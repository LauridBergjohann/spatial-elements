import { error } from '@sveltejs/kit';
import { watchesSpatialElements as elements } from '$lib/showcase/watches';
export const entries = () => elements.map((element) => ({ id: element.id }));
export function load({ params }: { params: { id: string } }) {
	const element = elements.find((item) => item.id === params.id);
	if (!element) error(404, 'Element not found');
	return { element };
}
