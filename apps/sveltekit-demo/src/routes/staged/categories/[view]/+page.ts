import { error } from '@sveltejs/kit';
import { items } from '$lib/staged-production-proof/catalog';
export function load({ params }: { params: { view: string } }) {
	if (params.view !== 'list' && params.view !== 'carousel') error(404, 'Unknown view');
	return { items, view: params.view };
}
