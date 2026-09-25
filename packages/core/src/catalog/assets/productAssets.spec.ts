import { describe, expect, it } from 'vitest';
import {
	createLegacyProductAssetManifest,
	getProductEntityKey,
	getRepresentationResource,
	ProductEntityStore
} from '../productAssets.js';

describe('product asset identity and migration', () => {
	it('retains logical product identity when its manifest changes and avoids compound-key collisions', () => {
		const store = new ProductEntityStore();
		const first = store.get('demo', 'column');
		const manifest = createLegacyProductAssetManifest('demo', 'column', {
			glb: '/assets/column.glb',
			hdr: '/assets/environment.hdr',
			background: { blurriness: 0, tint: '#fff', tintIntensity: 0 }
		});
		expect(store.setManifest(manifest)).toBe(first);
		expect(first.manifest).toBe(manifest);
		expect(store.get('other-brand', 'column')).not.toBe(first);
		expect(getProductEntityKey('a:b', 'c')).not.toBe(getProductEntityKey('a', 'b:c'));
	});

	it('does not invent canonical dimensions, a real low/high pair, or a poster for legacy assets', () => {
		const manifest = createLegacyProductAssetManifest('demo', 'column', {
			glb: '/assets/column.glb',
			hdr: '/assets/environment.hdr',
			background: { blurriness: 0, tint: '#fff', tintIntensity: 0 }
		});
		expect(manifest.status).toBe('legacy-unverified');
		expect(manifest.canonicalBounds).toBeNull();
		expect(manifest.representations.low.assetToCanonical).toBeNull();
		expect(manifest.representations.high).toBeNull();
		expect(manifest.poster).toBeNull();
		expect(manifest.metadataGaps).toContain('validated-low-representation');
		expect(getRepresentationResource(manifest.representations.low)).toMatchObject({
			url: '/assets/column.glb',
			revision: 'legacy-unversioned'
		});
	});
});
