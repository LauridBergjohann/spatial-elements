import { expect, test } from 'vitest';
import { geometryEndpoint } from './catalogGeometryRequest.js';

test('geometry endpoints retain identity and occurrence without directional flags', () => {
	const identity = { brandId: 'demo', spatialElementId: 'column', occurrence: 'main:column' };
	expect(geometryEndpoint({ ...identity, slot: 'detail.summary' })).toEqual({
		...identity,
		slot: 'detail.hero',
		role: 'geometry'
	});
	expect(geometryEndpoint({ ...identity, slot: 'detail.dock' }).slot).toBe('detail.dock');
	expect(geometryEndpoint({ ...identity, slot: 'carousel.neighbour' })).toEqual({
		...identity,
		slot: 'carousel.neighbour',
		role: 'geometry'
	});
});
