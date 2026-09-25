import type { ProductAssetResource, ProductMatrix4, ProductVector3 } from './productAssets.js';

/** A shared rendering frame does not imply a verified physical scale. */
export interface ProductLodPair {
	status: 'provisional-shared-frame' | 'verified-canonical-frame';
	revision: string;
	sourceUrl: string;
	low: ProductAssetResource;
	high: ProductAssetResource;
	assetToFrame: ProductMatrix4;
	bounds: { min: ProductVector3; max: ProductVector3 };
}

/** Explicit legacy source overrides invalidate the associated pair as well. */
export function resolveProductLodPair(glb: string, pair?: ProductLodPair) {
	return pair?.sourceUrl === glb ? pair : undefined;
}
