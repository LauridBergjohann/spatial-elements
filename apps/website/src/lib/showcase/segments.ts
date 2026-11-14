export const showcaseSegments = [
	{
		id: 'consumer',
		title: 'Consumer',
		manufacturers: ['logitech'],
		cardSize: 'l',
		description:
			'Technology for everyday life. Explore Logitech products for your desk, work and entertainment.'
	},
	{
		id: 'workbench',
		title: 'Workbench',
		manufacturers: ['wera'],
		cardSize: 's',
		description: 'Tools for home projects and professional workshops. Discover the Wera collection.'
	},
	{
		id: 'industrial',
		title: 'Industrial',
		manufacturers: ['item', 'wurm'],
		cardSize: 'm',
		description:
			'Modular engineering meets intelligent automation. Explore components from item and control systems from Wurm, presented with a blue frosted theme and tailored product panels.'
	},
	{
		id: 'exclusive',
		title: 'Exclusive',
		manufacturers: ['watches'],
		cardSize: 'l',
		description:
			'A closer look at luxury watchmaking with a Rolex chronograph. Glass panels, gold accents and softer corners demonstrate a different visual identity with the same navigation.'
	}
] as const;
export function productSegment(manufacturer: string) {
	const segment = showcaseSegments.find((item) =>
		item.manufacturers.some((name) => name === manufacturer)
	);
	if (!segment) throw new Error('Unknown showcase manufacturer: ' + manufacturer);
	return segment;
}
export function productHref(product: { id: string; manufacturerId: string }) {
	return '/showcase/' + productSegment(product.manufacturerId).id + '/' + product.id + '/';
}
