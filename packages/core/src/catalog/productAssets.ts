import { resolveProductLodPair, type ProductLodPair } from './productLodPair.js';
import type { ProductStageConfig } from '../product-detail/types.js';

export type ProductLod = 'low' | 'high';
export type ProductVector3 = readonly [number, number, number];
/** Column-major matrix, acting on homogeneous column vectors. */
export type ProductMatrix4 = readonly [
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

export interface ProductAssetRequirements {
	decoders: readonly ('draco' | 'meshopt' | 'ktx2')[];
	extensions: readonly string[];
}

export interface ProductAssetLocation {
	url: string;
	format: 'glb' | 'gltf';
}

/** Immutable resource request; identity is independent of product and presentation role. */
export interface ProductAssetResource extends ProductAssetLocation {
	revision: string;
	requirements?: ProductAssetRequirements;
}

export interface ProductAssetCosts {
	transferBytes: number;
	triangleCount: number;
	primitiveCount: number;
	materialCount: number;
	decodedGeometryBytes: number;
	estimatedTextureBytes: number;
	/** Documents assumptions used for decoded and estimated memory. */
	method: string;
}

export interface ProductProfileReference {
	id: string;
	revision: string;
}

export interface ProductPoster {
	src: string;
	alt: string;
	width: number;
	height: number;
}

export interface ProductAssetRepresentation {
	representationId: string;
	lod: ProductLod;
	assetRevision: string;
	canonicalRevision: string;
	resource: ProductAssetLocation;
	requirements: ProductAssetRequirements;
	assetToCanonical: ProductMatrix4;
	/** Null selects the entire authored scene; named roots must resolve uniquely. */
	productRoot: string | null;
	excludedMeshes: readonly string[];
	/** Semantic material roles mapped to representation-specific material names. */
	materialBindings: Readonly<Record<string, string>>;
	costs: ProductAssetCosts;
}

/** Verified contract: right-handed, +Y up, +Z front, meters, shared origin/pivot. */
export interface VerifiedProductAssetManifest {
	physicalReference?: {
		dimensionsMeters: ProductVector3;
		scope: string;
		provenance: string;
		measuredReferenceExtentsMeters: ProductVector3;
		relativeDeviation: ProductVector3;
		maximumRelativeDeviation: number;
	};
	schemaVersion: 1;
	status: 'verified';
	brandId: string;
	productId: string;
	canonicalRevision: string;
	canonicalBounds: { min: ProductVector3; max: ProductVector3 };
	referencePose: ProductProfileReference;
	referenceTarget: ProductVector3;
	referenceView: ProductProfileReference;
	appearanceProfile: ProductProfileReference;
	poster: ProductPoster;
	representations: {
		low: ProductAssetRepresentation & { lod: 'low' };
		high: (ProductAssetRepresentation & { lod: 'high' }) | null;
	};
}

export interface LegacyProductAssetRepresentation {
	representationId: 'legacy-preview';
	lod: 'low';
	assetRevision: string;
	canonicalRevision: null;
	resource: ProductAssetLocation;
	requirements: ProductAssetRequirements;
	assetToCanonical: null;
	costs: null;
}

/** Temporary adapter, explicitly not a physically verified or decimated low asset. */
export interface LegacyProductAssetManifest {
	schemaVersion: 1;
	status: 'legacy-unverified';
	brandId: string;
	productId: string;
	canonicalRevision: null;
	canonicalBounds: null;
	poster: ProductPoster | null;
	metadataGaps: readonly string[];
	stage: ProductStageConfig;
	representations: {
		low: LegacyProductAssetRepresentation;
		high: null;
	};
}

export interface ProvisionalProductAssetManifest {
	schemaVersion: 1;
	status: 'provisional-shared-frame';
	brandId: string;
	productId: string;
	canonicalRevision: null;
	pair: ProductLodPair;
	stage: ProductStageConfig;
}

export type ProductAssetManifest =
	VerifiedProductAssetManifest | LegacyProductAssetManifest | ProvisionalProductAssetManifest;

export function createStageProductAssetManifest(
	brandId: string,
	productId: string,
	stage: ProductStageConfig
): ProductAssetManifest {
	getProductEntityKey(brandId, productId);
	if (stage.assetManifest?.brandId === brandId && stage.assetManifest.productId === productId)
		return stage.assetManifest;
	const pair = resolveProductLodPair(stage.glb, stage.lodPair);
	return pair
		? {
				schemaVersion: 1,
				status: 'provisional-shared-frame',
				brandId,
				productId,
				canonicalRevision: null,
				pair,
				stage
			}
		: createLegacyProductAssetManifest(brandId, productId, stage);
}

export function getProductEntityKey(brandId: string, productId: string) {
	if (!brandId || !productId) throw new Error('Product identity requires brandId and productId');
	return JSON.stringify([brandId, productId]);
}

export function getRepresentationResource(
	representation: ProductAssetRepresentation | LegacyProductAssetRepresentation
): ProductAssetResource {
	return {
		...representation.resource,
		revision: representation.assetRevision,
		requirements: representation.requirements
	};
}

export function createLegacyProductAssetManifest(
	brandId: string,
	productId: string,
	stage: ProductStageConfig,
	poster: ProductPoster | null = stage.fallbackImage && stage.fallbackImageSize
		? {
				src: stage.fallbackImage,
				alt: `${brandId} ${productId}`,
				width: stage.fallbackImageSize[0],
				height: stage.fallbackImageSize[1]
			}
		: null
): LegacyProductAssetManifest {
	getProductEntityKey(brandId, productId);
	return {
		schemaVersion: 1,
		status: 'legacy-unverified',
		brandId,
		productId,
		canonicalRevision: null,
		canonicalBounds: null,
		poster,
		metadataGaps: [
			'physical-dimensions',
			'canonical-frame',
			'validated-low-representation',
			'resource-costs',
			...(!poster ? ['product-poster'] : [])
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

export interface ProductEntity {
	readonly key: string;
	readonly brandId: string;
	readonly productId: string;
	manifest: ProductAssetManifest | null;
}

/** Runtime-owned logical identities survive page and asset-instance replacement. */
export class ProductEntityStore {
	private readonly entities = new Map<string, ProductEntity>();

	get(brandId: string, productId: string): ProductEntity {
		const key = getProductEntityKey(brandId, productId);
		let entity = this.entities.get(key);
		if (!entity) {
			entity = { key, brandId, productId, manifest: null };
			this.entities.set(key, entity);
		}
		return entity;
	}

	setManifest(manifest: ProductAssetManifest) {
		const entity = this.get(manifest.brandId, manifest.productId);
		entity.manifest = manifest;
		return entity;
	}

	clear() {
		this.entities.clear();
	}
}
