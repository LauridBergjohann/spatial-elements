import { resolveSpatialElementLodPair, type SpatialElementLodPair } from './spatialElementLodPair.js';
import type { SpatialStageConfig } from '../spatial-element/types.js';

export type SpatialElementLod = 'low' | 'high';
export type SpatialElementVector3 = readonly [number, number, number];
/** Column-major matrix, acting on homogeneous column vectors. */
export type SpatialElementMatrix4 = readonly [
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number,
	number
];

export interface SpatialElementAssetRequirements {
	decoders: readonly ('draco' | 'meshopt' | 'ktx2')[];
	extensions: readonly string[];
}

export interface SpatialElementAssetLocation {
	url: string;
	format: 'glb' | 'gltf';
}

/** Immutable resource request; identity is independent of element and presentation role. */
export interface SpatialElementAssetResource extends SpatialElementAssetLocation {
	revision: string;
	requirements?: SpatialElementAssetRequirements;
}

export interface SpatialElementAssetCosts {
	transferBytes: number;
	triangleCount: number;
	primitiveCount: number;
	materialCount: number;
	decodedGeometryBytes: number;
	estimatedTextureBytes: number;
	/** Documents assumptions used for decoded and estimated memory. */
	method: string;
}

export interface SpatialElementProfileReference {
	id: string;
	revision: string;
}

export interface SpatialElementPoster {
	src: string;
	alt: string;
	width: number;
	height: number;
}

export interface SpatialElementAssetRepresentation {
	representationId: string;
	lod: SpatialElementLod;
	assetRevision: string;
	canonicalRevision: string;
	resource: SpatialElementAssetLocation;
	requirements: SpatialElementAssetRequirements;
	assetToCanonical: SpatialElementMatrix4;
	/** Null selects the entire authored scene; named roots must resolve uniquely. */
	spatialElementRoot: string | null;
	excludedMeshes: readonly string[];
	/** Semantic material roles mapped to representation-specific material names. */
	materialBindings: Readonly<Record<string, string>>;
	costs: SpatialElementAssetCosts;
}

/** Verified contract: right-handed, +Y up, +Z front, meters, shared origin/pivot. */
export interface VerifiedSpatialElementAssetManifest {
	physicalReference?: {
		dimensionsMeters: SpatialElementVector3;
		scope: string;
		provenance: string;
		measuredReferenceExtentsMeters: SpatialElementVector3;
		relativeDeviation: SpatialElementVector3;
		maximumRelativeDeviation: number;
	};
	schemaVersion: 1;
	status: 'verified';
	brandId: string;
	spatialElementId: string;
	canonicalRevision: string;
	canonicalBounds: { min: SpatialElementVector3; max: SpatialElementVector3 };
	referencePose: SpatialElementProfileReference;
	referenceTarget: SpatialElementVector3;
	referenceView: SpatialElementProfileReference;
	appearanceProfile: SpatialElementProfileReference;
	poster: SpatialElementPoster;
	representations: {
		low: SpatialElementAssetRepresentation & { lod: 'low' };
		high: (SpatialElementAssetRepresentation & { lod: 'high' }) | null;
	};
}

export interface LegacySpatialElementAssetRepresentation {
	representationId: 'legacy-preview';
	lod: 'low';
	assetRevision: string;
	canonicalRevision: null;
	resource: SpatialElementAssetLocation;
	requirements: SpatialElementAssetRequirements;
	assetToCanonical: null;
	costs: null;
}

/** Temporary adapter, explicitly not a physically verified or decimated low asset. */
export interface LegacySpatialElementAssetManifest {
	schemaVersion: 1;
	status: 'legacy-unverified';
	brandId: string;
	spatialElementId: string;
	canonicalRevision: null;
	canonicalBounds: null;
	poster: SpatialElementPoster | null;
	metadataGaps: readonly string[];
	stage: SpatialStageConfig;
	representations: {
		low: LegacySpatialElementAssetRepresentation;
		high: null;
	};
}

export interface ProvisionalSpatialElementAssetManifest {
	schemaVersion: 1;
	status: 'provisional-shared-frame';
	brandId: string;
	spatialElementId: string;
	canonicalRevision: null;
	pair: SpatialElementLodPair;
	stage: SpatialStageConfig;
}

export type SpatialElementAssetManifest =
	VerifiedSpatialElementAssetManifest | LegacySpatialElementAssetManifest | ProvisionalSpatialElementAssetManifest;

export function createStageSpatialElementAssetManifest(
	brandId: string,
	spatialElementId: string,
	stage: SpatialStageConfig
): SpatialElementAssetManifest {
	getSpatialElementEntityKey(brandId, spatialElementId);
	if (stage.assetManifest?.brandId === brandId && stage.assetManifest.spatialElementId === spatialElementId)
		return stage.assetManifest;
	const pair = resolveSpatialElementLodPair(stage.glb, stage.lodPair);
	return pair
		? {
				schemaVersion: 1,
				status: 'provisional-shared-frame',
				brandId,
				spatialElementId,
				canonicalRevision: null,
				pair,
				stage
			}
		: createLegacySpatialElementAssetManifest(brandId, spatialElementId, stage);
}

export function getSpatialElementEntityKey(brandId: string, spatialElementId: string) {
	if (!brandId || !spatialElementId) throw new Error('SpatialElement identity requires brandId and spatialElementId');
	return JSON.stringify([brandId, spatialElementId]);
}

export function getRepresentationResource(
	representation: SpatialElementAssetRepresentation | LegacySpatialElementAssetRepresentation
): SpatialElementAssetResource {
	return {
		...representation.resource,
		revision: representation.assetRevision,
		requirements: representation.requirements
	};
}

export function createLegacySpatialElementAssetManifest(
	brandId: string,
	spatialElementId: string,
	stage: SpatialStageConfig,
	poster: SpatialElementPoster | null = stage.fallbackImage && stage.fallbackImageSize
		? {
				src: stage.fallbackImage,
				alt: `${brandId} ${spatialElementId}`,
				width: stage.fallbackImageSize[0],
				height: stage.fallbackImageSize[1]
			}
		: null
): LegacySpatialElementAssetManifest {
	getSpatialElementEntityKey(brandId, spatialElementId);
	return {
		schemaVersion: 1,
		status: 'legacy-unverified',
		brandId,
		spatialElementId,
		canonicalRevision: null,
		canonicalBounds: null,
		poster,
		metadataGaps: [
			'physical-dimensions',
			'canonical-frame',
			'validated-low-representation',
			'resource-costs',
			...(!poster ? ['spatial-element-poster'] : [])
		],
		stage,
		representations: {
			low: {
				representationId: 'legacy-preview',
				lod: 'low',
				assetRevision: 'legacy-unversioned',
				canonicalRevision: null,
				resource: { url: stage.glb, format: 'glb' },
				requirements: { decoders: ['draco'], extensions: [] },
				assetToCanonical: null,
				costs: null
			},
			high: null
		}
	};
}

export interface SpatialElementEntity {
	readonly key: string;
	readonly brandId: string;
	readonly spatialElementId: string;
	manifest: SpatialElementAssetManifest | null;
}

/** Runtime-owned logical identities survive page and asset-instance replacement. */
export class SpatialElementEntityStore {
	private readonly entities = new Map<string, SpatialElementEntity>();

	get(brandId: string, spatialElementId: string): SpatialElementEntity {
		const key = getSpatialElementEntityKey(brandId, spatialElementId);
		let entity = this.entities.get(key);
		if (!entity) {
			entity = { key, brandId, spatialElementId, manifest: null };
			this.entities.set(key, entity);
		}
		return entity;
	}

	setManifest(manifest: SpatialElementAssetManifest) {
		const entity = this.get(manifest.brandId, manifest.spatialElementId);
		entity.manifest = manifest;
		return entity;
	}

	clear() {
		this.entities.clear();
	}
}
