import { error } from '@sveltejs/kit';
import { spatialElements } from '$lib/forms';
export const entries = () => spatialElements.map((element) => ({ id: element.id }));
export function load({ params }: { params: { id: string } }) {
	const element = spatialElements.find((item) => item.id === params.id);
	if (!element) error(404);
	return { element };
}
