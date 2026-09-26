import { expect, test } from 'vitest';
import { resolveStageProfile } from './resolveStageProfile.js';
import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';

test('a legacy GLB override cannot adopt the old canonical frame or LOD descriptors', () => {
	const pair = { sourceUrl: '/original.glb' } as SpatialElementLodPair;
	expect(resolveStageProfile({ glb: '/original.glb', lodPair: pair }).lodPair).toBe(pair);
	const override = resolveStageProfile({ glb: '/override.glb', lodPair: pair });
	expect(override.lodPair).toBeUndefined();
	expect(override.modelKey).toBe(JSON.stringify(['/override.glb', {}]));
});

test('resolved view settings do not follow later author mutations or inherit previous view options', () => {
	const model = { rotation: { y: 1 }, excludeMeshes: ['shell'] };
	const camera = { azimuth: 20 };
	const profile = resolveStageProfile({ model, camera }, { glb: '/saved.glb', hdr: '/saved.hdr' });
	model.rotation.y = 3;
	model.excludeMeshes.push('screen');
	camera.azimuth = 40;
	expect(profile.model.rotation?.y).toBe(1);
	expect(profile.model.excludeMeshes).toEqual(['shell']);
	expect(profile.camera.azimuth).toBe(20);
	expect(profile.hdr).toBe('/saved.hdr');
	expect(resolveStageProfile({}, profile).model).toEqual({});
	expect(Object.isFrozen(profile)).toBe(true);
});
