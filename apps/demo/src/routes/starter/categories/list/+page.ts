import { getSpatialListItems } from '@spatial-elements/sveltekit';
import { starterElements } from '$lib/starter';

export function load() {
	return { items: getSpatialListItems(starterElements, '/starter/elements') };
}
