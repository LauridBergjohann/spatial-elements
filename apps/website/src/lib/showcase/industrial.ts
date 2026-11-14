/** Editorial content belongs to the website, independently of the spatial components. */
export const industrialBrands = [
	{
		id: 'item',
		name: 'item',
		href: 'https://www.item24.com/',
		image: '/assets/brands/item-picture.webp',
		width: 1440,
		height: 960,
		alt: 'An engineer plans an aluminium profile enclosure with the item Engineeringtool',
		description:
			'From a first idea to a production-ready workstation: item develops modular aluminium profile systems for machine building, automation and ergonomic workplaces. Compatible profiles, connectors and accessories turn individual components into adaptable solutions. Explore the details here, then discover how the building kit can support your next engineering project.'
	},
	{
		id: 'wurm',
		name: 'Wurm',
		href: 'https://www.wurm.de/',
		image: '/assets/brands/wurm-picture.webp',
		width: 1440,
		height: 686,
		alt: 'Operating the blue Wurm control panel on a refrigeration installation',
		description:
			'Behind efficient refrigeration is intelligent control. Wurm develops electronic control systems and software for refrigeration and building technology in food retail. Master modules, field modules, displays and gateways work together to monitor and coordinate installations. Take a closer look at the hardware, then explore the connected solutions that help operators understand and improve their systems.'
	}
] as const;

export const industrialHighlights = [
	'wurm-asv101',
	'item-profile',
	'wurm-hks-g4',
	'item-connector'
];
