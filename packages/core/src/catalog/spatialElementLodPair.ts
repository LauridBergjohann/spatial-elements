import type { SpatialElementAssetResource, SpatialElementMatrix4, SpatialElementVector3 } from './spatialElementAssets.js';

/** A shared rendering frame does not imply a verified physical scale. */
export interface SpatialElementLodPair {
	status: 'provisional-shared-frame' | 'verified-canonical-frame';
	revision: string;
	sourceUrl: string;
	low: SpatialElementAssetResource;
	high: SpatialElementAssetResource;
	assetToFrame: SpatialElementMatrix4;
	bounds: { min: SpatialElementVector3; max: SpatialElementVector3 };
}

/** Explicit legacy source overrides invalidate the associated pair as well. */
export function resolveSpatialElementLodPair(glb: string, pair?: SpatialElementLodPair) {
	return pair?.sourceUrl === glb ? pair : undefined;
}
