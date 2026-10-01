import { error } from '@sveltejs/kit';
import { findSpatialElement } from '@spatial-elements/sveltekit';
import { starterElements } from '$lib/starter';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params }) => {
	const element = findSpatialElement(starterElements, params.id);
	if (!element) error(404, 'Element not found');
	return { element };
};
