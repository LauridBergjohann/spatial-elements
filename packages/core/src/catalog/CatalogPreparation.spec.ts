import { expect, test } from 'vitest';
import { preparationKey } from './CatalogPreparation.js';
import { DEFAULT_BACKGROUND } from '../stage/stageConstants.js';

test('implicit background defaults reuse the prefetched presentation on detail binding', () => {
 const element = { glb: '/cube.glb', hdr: '/studio.hdr' };
 expect(preparationKey(element)).toBe(preparationKey({ ...element, background: DEFAULT_BACKGROUND, model: {} }));
 expect(preparationKey(element)).not.toBe(preparationKey({ ...element, background: { ...DEFAULT_BACKGROUND, tintIntensity: 0.8 } }));
});
