import * as THREE from 'three/webgpu';
import type { Material, Mesh, Object3D } from 'three';
import { MINIMAP_MODEL_RENDER_ORDER } from '../stageConstants.js';
import { disposeMaterialOnly } from '../stageSceneUtils.js';

/** Original material state retained while a minimap fades between overlay and hover views. */
export interface MinimapMaterialOpacityState {
	material: Material;
	opacity: number;
	transparent: boolean;
	depthWrite: boolean;
}

/** Clones minimap materials so opacity changes cannot mutate the main product. */
export function prepareMinimapModel(model: Object3D) {
	const materials: MinimapMaterialOpacityState[] = [];
	model.traverse((child) => {
		const mesh = child as Mesh;
		if (!mesh.isMesh) return;
		mesh.frustumCulled = false;
		mesh.renderOrder = MINIMAP_MODEL_RENDER_ORDER;
		mesh.material = cloneMinimapMaterial(mesh.material);
		const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
		meshMaterials.forEach((material) => {
			materials.push({
				material,
				opacity: material.opacity,
				transparent: material.transparent,
				depthWrite: material.depthWrite
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
		if (mesh.isMesh) disposeMaterialOnly(mesh.material);
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
