import { getSpatialListItems } from '@spatial-elements/sveltekit';
import { optimizedSpatialElement } from './optimized';
import { showcaseProducts } from './products';

export const showcaseElements = showcaseProducts.map(optimizedSpatialElement);

export const showcaseItems = getSpatialListItems(showcaseElements, '/showcase').map((item) => ({
	...item,
	href: showcaseProducts.find((product) => product.id === item.id)!.href
}));
export const featuredItems = [
	'kraftform-kompakt',
	'chronograph',
	'logitech-ergo-k860',
	'logitech-z407'
].map((id) => showcaseItems.find((item) => item.id === id)!);
