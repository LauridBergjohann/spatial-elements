import { expect, test } from 'vitest';
import { geometryEndpoint } from './catalogGeometryRequest.js';

test('geometry endpoints retain identity and occurrence without directional flags', () => {
	const identity = { brandId: 'demo', productId: 'column', occurrence: 'main:column' };
	expect(geometryEndpoint({ ...identity, slot: 'pdp.summary' })).toEqual({
		...identity,
		slot: 'pdp.hero',
		role: 'geometry'
	});
	expect(geometryEndpoint({ ...identity, slot: 'pdp.dock' }).slot).toBe('pdp.dock');
	expect(geometryEndpoint({ ...identity, slot: 'carousel.neighbour' })).toEqual({
		...identity,
		slot: 'carousel.neighbour',
		role: 'geometry'
	});
});
