export const showcaseSegments = [
	{
		id: 'consumer',
		title: 'Consumer',
		manufacturer: 'logitech',
		cardSize: 'l',
		description:
			'Technology for everyday life. Explore Logitech products for your desk, work and entertainment.'
	},
	{
		id: 'workbench',
		title: 'Workbench',
		manufacturer: 'wera',
		cardSize: 's',
		description: 'Tools for home projects and professional workshops. Discover the Wera collection.'
	},
	{
		id: 'industrial',
		title: 'Industrial',
		manufacturer: 'item',
		cardSize: 's',
		description:
			'Components for industrial engineering. Explore profiles and connections from item.'
	},
	{
		id: 'exclusive',
		title: 'Exclusive',
		manufacturer: 'watches',
		cardSize: 'l',
		description: 'A closer look at luxury watchmaking with a Rolex chronograph.'
	}
] as const;
export function productSegment(manufacturer: string) {
	const segment = showcaseSegments.find((item) => item.manufacturer === manufacturer);
	if (!segment) throw new Error('Unknown showcase manufacturer: ' + manufacturer);
	return segment;
}
export function productHref(product: { id: string; manufacturerId: string }) {
	return '/showcase/' + productSegment(product.manufacturerId).id + '/' + product.id + '/';
}
