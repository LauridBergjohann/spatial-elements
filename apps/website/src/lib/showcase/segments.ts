export const showcaseSegments = [
	{
		id: 'consumer',
		image: 'consumer.webp',
		title: 'Everyday Tech',
		eyebrow: 'CONSUMER ELECTRONICS · B2C',
		manufacturers: ['logitech'],
		cardSize: 'l',
		description: 'Explore the technology that shapes how we work, play, and connect.'
	},
	{
		id: 'workbench',
		image: 'workbench.webp',
		title: 'Precision in Hand',
		eyebrow: 'TOOLS · MAKERS · CRAFTSMANSHIP',
		manufacturers: ['wera'],
		cardSize: 's',
		description:
			'Discover quality tools for professionals, passionate makers, and everyday projects.'
	},
	{
		id: 'industrial',
		image: 'industrial.webp',
		title: ' Built for Industry',
		eyebrow: 'AUTOMATION · ENGINEERING  · B2B',
		manufacturers: ['item', 'wurm'],
		cardSize: 'm',
		description: 'Explore the components and technologies powering modern industry and automation.'
	},
	{
		id: 'exclusive',
		image: 'exclusive.webp',
		title: 'Beyond the Ordinary',
		eyebrow: 'LUXURY · DESIGN · CRAFTSMANSHIP',
		manufacturers: ['watches'],
		cardSize: 'l',
		description:
			'Discover exceptional timepieces and luxury goods where craftsmanship meets timeless design.'
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
