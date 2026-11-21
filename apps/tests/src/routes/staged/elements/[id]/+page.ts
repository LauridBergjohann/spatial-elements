import { error } from '@sveltejs/kit';
import { elements } from '#lib/staged-production-proof/catalog.ts';
export function load({ params }: { params: { id: string } }) {
	const element = elements.find((element) => element.id === params.id);
	if (!element) error(404, 'Unknown element');
	return { element };
}
