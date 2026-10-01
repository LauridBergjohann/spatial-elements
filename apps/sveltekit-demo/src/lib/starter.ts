import { createSpatialTheme, type SpatialElementData } from '@spatial-elements/sveltekit';

export const starterTheme = createSpatialTheme({ id: 'starter', name: 'My collection' });

export const starterElements: SpatialElementData[] = [
	{
		id: 'cube',
		title: 'Cube',
		geometry: { low: '/assets/demo/cube-high.glb', high: '/assets/demo/cube-high.glb' },
		hdr: '/assets/demo/studio.hdr',
		fallbackImage: '/assets/demo/cube.svg'
	}
];
