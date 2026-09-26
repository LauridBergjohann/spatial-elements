import type { AnimationClip, BufferGeometry, Material, Object3D, Skeleton, Texture } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export interface LoadedSpatialElementAsset {
	/** Cache-owned source scene. Consumers must create an instance before mutation. */
	scene: Object3D;
	scenes?: readonly Object3D[];
	animations?: readonly AnimationClip[];
	/** Optional custom ownership boundary supplied by an injected loader. */
	dispose?: () => void;
	timings?: { fetchMs: number; decodeMs: number; gateWaitMs: number };
}

export interface SpatialElementAssetInstance {
	scene: Object3D;
	/** Immutable clips may be shared; mixers and animation state belong to the presentation. */
	animations: readonly AnimationClip[];
	dispose(): void;
}

/** Releases cache-owned resources once, including resources shared between GLTF scenes. */
export function disposeLoadedSpatialElementAsset(asset: LoadedSpatialElementAsset) {
	if (asset.dispose) {
		asset.dispose();
		return;
	}
	const geometries = new Set<BufferGeometry>();
	const materials = new Set<Material>();
	const textures = new Set<Texture>();
	const skeletons = new Set<Skeleton>();
	for (const scene of new Set([asset.scene, ...(asset.scenes ?? [])])) {
		scene.traverse((object) => {
			const renderable = object as Object3D & {
				geometry?: BufferGeometry;
				material?: Material | Material[];
				skeleton?: Skeleton;
			};
			if (renderable.geometry) geometries.add(renderable.geometry);
			if (renderable.skeleton) skeletons.add(renderable.skeleton);
			if (renderable.material) {
				for (const material of Array.isArray(renderable.material)
					? renderable.material
					: [renderable.material])
					materials.add(material);
			}
		});
	}
	for (const material of materials) {
		for (const value of Object.values(material)) {
			if (value && typeof value === 'object' && 'isTexture' in value && value.isTexture) {
				textures.add(value as Texture);
			}
		}
	}
	const bitmaps = new Set<ImageBitmap>();
	for (const texture of textures) {
		const data = texture.source?.data;
		if (typeof ImageBitmap !== 'undefined' && data instanceof ImageBitmap) bitmaps.add(data);
		texture.dispose();
	}
	for (const bitmap of bitmaps) bitmap.close();
	for (const skeleton of skeletons) skeleton.dispose();
	for (const material of materials) material.dispose();
	for (const geometry of geometries) geometry.dispose();
}

/** Clones mutable instance state while retaining cache-owned geometries and textures. */
export function createSpatialElementAssetInstance(
	asset: LoadedSpatialElementAsset,
	onDispose: () => void
): SpatialElementAssetInstance {
	const scene = clone(asset.scene);
	const materials = new Map<Material, Material>();
	const skeletons = new Set<Skeleton>();
	try {
		scene.traverse((object) => {
			const renderable = object as Object3D & {
				material?: Material | Material[];
				skeleton?: Skeleton;
			};
			if (renderable.skeleton) skeletons.add(renderable.skeleton);
			if (!renderable.material) return;
			const cloneMaterial = (source: Material) => {
				let instance = materials.get(source);
				if (!instance) {
					instance = source.clone();
					materials.set(source, instance);
				}
				return instance;
			};
			renderable.material = Array.isArray(renderable.material)
				? renderable.material.map(cloneMaterial)
				: cloneMaterial(renderable.material);
		});
	} catch (error) {
		for (const material of materials.values()) material.dispose();
		for (const skeleton of skeletons) skeleton.dispose();
		throw error;
	}
	let disposed = false;
	return {
		scene,
		animations: asset.animations ?? [],
		dispose() {
			if (disposed) return;
			disposed = true;
			scene.removeFromParent();
			// Overrides added later remain the presentation's responsibility.
			for (const material of materials.values()) material.dispose();
			for (const skeleton of skeletons) skeleton.dispose();
			onDispose();
		}
	};
}
