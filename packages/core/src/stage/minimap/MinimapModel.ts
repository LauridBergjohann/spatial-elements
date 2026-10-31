import * as THREE from 'three/webgpu';
import type { Material, Mesh, Object3D } from 'three';
import { MINIMAP_MODEL_RENDER_ORDER } from '../stageConstants.js';
import { disposeMaterialOnly } from '../stageSceneUtils.js';

/** Original material state retained while a minimap fades between overlay and hover views. */
export interface MinimapMaterialOpacityState {
	readonly material: Material;
	opacity: number;
	transparent: boolean;
	depthWrite: boolean;
	setOpacity(opacity: number): void;
}

// Material identity participates in Three's render-object cache. Mutating the
// same material's transparency at either endpoint disposes its other pipeline.
// Retain both owners while sharing the actual mesh, geometry and texture assets.
const ownedMaterials = new WeakMap<Mesh, { rest: Material | Material[]; fade?: Material | Material[] }>();

/** Clones minimap materials so opacity changes cannot mutate the main element. */
export function prepareMinimapModel(model: Object3D) {
	const materials: MinimapMaterialOpacityState[] = [];
	model.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh) return;
		mesh.frustumCulled = false;
		mesh.renderOrder = MINIMAP_MODEL_RENDER_ORDER;
		mesh.material = cloneMinimapMaterial(mesh.material);
		const owned = { rest: mesh.material, fade: undefined as Material | Material[] | undefined };
		ownedMaterials.set(mesh, owned);
		const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		meshMaterials.forEach((material, index) => {
			materials.push({
				get material() { return Array.isArray(mesh.material) ? mesh.material[index] : mesh.material; },
				opacity: material.opacity,
				transparent: material.transparent,
				depthWrite: material.depthWrite,
				setOpacity(opacity) {
					if (opacity === 1) {
						mesh.material = owned.rest;
						return;
					}
					if (!owned.fade) {
						owned.fade = cloneMinimapMaterial(owned.rest);
						for (const fade of Array.isArray(owned.fade) ? owned.fade : [owned.fade]) {
							fade.transparent = true;
							fade.depthWrite = false;
						}
					}
					mesh.material = owned.fade;
					this.material.opacity = this.opacity * opacity;
				}
			});
		});
	});
	return materials;
}

/** Adds neutral lighting to the isolated minimap blur capture. */
export function addMinimapBlurLights(scene: THREE.Scene) {
	const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
	keyLight.position.set(-2, 3, 8);
	scene.add(keyLight);
	scene.add(new THREE.AmbientLight(0xffffff, 0.7));
}

/** Disposes material clones owned by a minimap model. */
export function disposeMinimapModelMaterials(model: Object3D) {
	model.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh) return;
		const owned = ownedMaterials.get(mesh);
		if (owned) {
			disposeMaterialOnly(owned.rest);
			if (owned.fade) disposeMaterialOnly(owned.fade);
			ownedMaterials.delete(mesh);
		} else disposeMaterialOnly(mesh.material);
	});
}

function cloneMinimapMaterial(material: Material | Material[]): Material | Material[] {
	return Array.isArray(material)
		? material.map(cloneSingleMinimapMaterial)
		: cloneSingleMinimapMaterial(material);
}

function cloneSingleMinimapMaterial(material: Material): Material {
	const clone = material.clone();
	clone.needsUpdate = true;
	return clone;
}
