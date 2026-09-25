import * as THREE from 'three/webgpu';
import type { Material, Mesh, Object3D, WebGLRenderTarget } from 'three';
import type { StageMaterialSettings } from './stageTypes.js';

export type StageMeshFilter = (mesh: Mesh) => boolean;

/** Returns a mesh material as an array without mutating the mesh. */
export function getMeshMaterials(mesh: Mesh) {
	return Array.isArray(mesh.material) ? mesh.material : [mesh.material];
}

/** Type guard for traversed Three.js objects. */
export function isMesh(object: Object3D): object is Mesh {
	return (object as Mesh).isMesh === true;
}

/**
 * Returns world-space bounds for the selected meshes below an object.
 *
 * Excluded meshes remain untouched and visible. Computing their bounds separately
 * lets decorative geometry follow the product transform without affecting its fit.
 */
export function getMeshBounds(model: Object3D, includeMesh: StageMeshFilter = () => true) {
	const bounds = new THREE.Box3();
	model.updateWorldMatrix(true, true);

	model.traverse((child) => {
		if (!isMesh(child) || !includeMesh(child)) return;

		if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
		const geometryBounds = child.geometry.boundingBox;
		if (geometryBounds) bounds.union(geometryBounds.clone().applyMatrix4(child.matrixWorld));
	});

	return bounds;
}

/**
 * Returns the world-space corners of each selected mesh's own bounding box.
 * Keeping the boxes separate avoids the empty corner volume introduced by one
 * global box around sparse or rotated product geometry.
 */
export function getMeshBoundsPoints(model: Object3D, includeMesh: StageMeshFilter = () => true) {
	const points: THREE.Vector3[] = [];
	model.updateWorldMatrix(true, true);

	model.traverse((child) => {
		if (!isMesh(child) || !includeMesh(child)) return;

		if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
		const geometryBounds = child.geometry.boundingBox;
		if (!geometryBounds) return;

		const { min, max } = geometryBounds;
		for (const x of [min.x, max.x]) {
			for (const y of [min.y, max.y]) {
				for (const z of [min.z, max.z]) {
					points.push(new THREE.Vector3(x, y, z).applyMatrix4(child.matrixWorld));
				}
			}
		}
	});

	return points;
}

/**
 * Centers a loaded model at the world origin and normalizes the selected meshes'
 * largest dimension.
 *
 * This makes camera fitting independent of the source GLB's authored units.
 */
export function centerAndScale(model: Object3D, includeMesh?: StageMeshFilter) {
	const box = getMeshBounds(model, includeMesh);
	if (box.isEmpty()) return;

	const size = box.getSize(new THREE.Vector3());
	const center = box.getCenter(new THREE.Vector3());
	const largestAxis = Math.max(size.x, size.y, size.z, 1);
	const scale = 3 / largestAxis;
	model.scale.setScalar(scale);
	model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
}

/**
 * Applies declarative, mesh-specific material replacements.
 *
 * The returned source materials are no longer referenced by the model and remain
 * the caller's responsibility to dispose.
 */
export function applyModelMaterialOverrides(
	model: Object3D,
	overrides?: Readonly<Record<string, StageMaterialSettings>>
) {
	const replacedMaterials = new Set<Material>();
	if (!overrides) return replacedMaterials;

	model.traverse((child) => {
		if (!isMesh(child)) return;
		const settings = overrides[child.name];
		if (!settings) return;

		getMeshMaterials(child).forEach((material) => replacedMaterials.add(material));
		child.material = createStageMaterial(settings, child.name);
	});

	const retainedMaterials = new Set<Material>();
	model.traverse((child) => {
		if (isMesh(child))
			getMeshMaterials(child).forEach((material) => retainedMaterials.add(material));
	});
	retainedMaterials.forEach((material) => replacedMaterials.delete(material));

	return replacedMaterials;
}

function createStageMaterial(settings: StageMaterialSettings, meshName: string) {
	const opacity = THREE.MathUtils.clamp(settings.opacity ?? 1, 0, 1);
	const material = new THREE.MeshPhysicalMaterial({
		blending: settings.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
		clearcoat: THREE.MathUtils.clamp(settings.clearcoat ?? 0, 0, 1),
		color: settings.color ?? 0xffffff,
		iridescence: THREE.MathUtils.clamp(settings.iridescence ?? 0, 0, 1),
		metalness: THREE.MathUtils.clamp(settings.metalness ?? 0, 0, 1),
		opacity,
		roughness: THREE.MathUtils.clamp(settings.roughness ?? 1, 0, 1),
		transparent: settings.transparent ?? opacity < 1
	});
	material.name = `${meshName}-stage-override`;
	return material;
}

/** Disposes geometries, materials, and material-owned textures below an object. */
export function disposeObject(object: Object3D) {
	object.traverse((child) => {
		const mesh = child as Mesh;
		mesh.geometry?.dispose();
		disposeMaterial(mesh.material);
	});
}

/** Disposes a material and disposable resources referenced by it. */
export function disposeMaterial(material?: Material | Material[]) {
	if (!material) return;
	if (Array.isArray(material)) {
		material.forEach(disposeMaterial);
		return;
	}
	Object.values(material).forEach((value) => {
		if (isDisposable(value)) value.dispose();
	});
	material.dispose();
}

/** Disposes only material instances, leaving their referenced textures untouched. */
export function disposeMaterialOnly(material?: Material | Material[]) {
	if (!material) return;
	if (Array.isArray(material)) {
		material.forEach(disposeMaterialOnly);
		return;
	}
	material.dispose();
}

function isDisposable(value: unknown): value is WebGLRenderTarget | THREE.Texture {
	return (
		typeof value === 'object' &&
		value !== null &&
		'dispose' in value &&
		typeof value.dispose === 'function'
	);
}
