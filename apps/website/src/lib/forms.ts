import {
	getSpatialListItems,
	type SpatialElementData,
	type SpatialElementLodPair
} from '@spatial-elements/core';
const identity: SpatialElementLodPair['assetToFrame'] = [
	1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
];
export const spatialElements: SpatialElementData[] = [
	'column',
	'orb',
	'ring',
	'cube',
	'torus-knot'
].map((id) => {
	const title = id
		.split('-')
		.map((word) => word[0].toUpperCase() + word.slice(1))
		.join(' ');
	const url = '/assets/demo/' + id + '-high.glb';
	return {
		id,
		brandId: 'docs/examples',
		pageTitle: title + ' | Spatial Elements',
		eyebrow: 'FORM STUDIES',
		title,
		features: [
			{ label: 'Explore a sculptural form' },
			{ label: 'Rotate and zoom in three dimensions' }
		],
		action: { label: 'Explore features', href: '#features' },

		hdr: '/assets/demo/studio.hdr',
		geometry: {
			status: 'provisional-shared-frame',
			revision: 'demo-1',
			low: { url: '/assets/demo/' + id + '-low.glb', format: 'glb', revision: 'demo-1' },
			high: { url, format: 'glb', revision: 'demo-1' },
			assetToFrame: identity,
			bounds: { min: [-1, -1, -1], max: [1, 1, 1] }
		},
		fallbackImage: '/assets/demo/' + id + '.svg',
		fallbackImageSize: [320, 280],
		camera: { azimuth: 15, elevation: 10 },

		breadcrumbs: [{ label: 'Collection', href: '/docs/sections/playground/' }, { label: id }],
		media: [{ id: 'model', kind: 'minimap', label: '3D view' }]
	};
});
export const overview = getSpatialListItems(spatialElements, '/docs/examples/elements').map(
	(item) => ({
		...item,
		summary: {
			...item.summary!,
			sectionLink: { href: item.href + '#features', label: 'Explore features' }
		}
	})
);
