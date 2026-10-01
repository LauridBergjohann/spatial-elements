import type { SpatialElementAssetResource } from '../catalog/spatialElementAssets.js';
import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';

/** Two required representations in the same authored coordinate frame. */
export interface SpatialElementGeometry {
	/** Lightweight GLB used in categories and during navigation. A URL is sufficient. */
	low: string | SpatialElementAssetResource;
	/** Detailed GLB used on the detail page. The same URL as low shares one cached load. */
	high: string | SpatialElementAssetResource;
	/** Optional generated coordinate transform, column-major. Defaults to identity. */
	assetToFrame?: SpatialElementLodPair['assetToFrame'];
	/** Optional shared frame bounds. Without these, the Low model determines the fit. */
	bounds?: SpatialElementLodPair['bounds'];
	/** Optional generated frame revision, independent of each resource's revision. */
	revision?: string;
	/** Optional provenance; declaring a shared frame does not verify physical dimensions. */
	status?: SpatialElementLodPair['status'];
}

/** Adapt an existing asset-pipeline LOD pair without exposing its redundant sourceUrl. */
export function geometryFromLodPair(pair: SpatialElementLodPair): SpatialElementGeometry {
	const { sourceUrl: _, ...geometry } = pair;
	return geometry;
}

/** @internal Normalize URL shorthand once at the authoring/runtime boundary. */
export function resolveSpatialElementGeometry(
	geometry: SpatialElementGeometry
): SpatialElementLodPair {
	const resource = (value: string | SpatialElementAssetResource): SpatialElementAssetResource => {
		const result =
			typeof value === 'string'
				? { url: value, format: 'glb' as const, revision: 'url-versioned' }
				: value;
		if (!result?.url?.trim() || !result.revision)
			throw new Error('geometry.low and geometry.high must each specify a non-empty model URL.');
		return result;
	};
	if (!geometry) throw new Error('Spatial elements require geometry: { low, high }.');
	let low = resource(geometry.low),
		high = resource(geometry.high);
	if (low.url === high.url) {
		if (
			typeof geometry.low !== 'string' &&
			typeof geometry.high !== 'string' &&
			(low.revision !== high.revision ||
				low.format !== high.format ||
				JSON.stringify(low.requirements) !== JSON.stringify(high.requirements))
		) {
			throw new Error(
				'Identical geometry URLs must use matching resource revisions and decoder requirements.'
			);
		}
		// A role never changes asset identity, including when one side uses URL shorthand.
		low = high = typeof geometry.low !== 'string' ? low : high;
	}
	return {
		low,
		high,
		sourceUrl: high.url,
		revision: geometry.revision ?? 'geometry-v1',
		status: geometry.status ?? 'provisional-shared-frame',
		assetToFrame: geometry.assetToFrame ?? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
		bounds: geometry.bounds
	};
}
