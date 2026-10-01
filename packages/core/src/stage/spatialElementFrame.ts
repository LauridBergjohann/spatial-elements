import * as THREE from 'three/webgpu';
import { getMeshBounds } from './stageSceneUtils.js';
import type { SpatialElementLodPair } from '../catalog/spatialElementLodPair.js';
import type { StageModelSettings } from './stageTypes.js';

/** The same import and fit transform is used for both LODs and every presentation. */
export function prepareSpatialElementFrame(
	model: THREE.Object3D,
	source: THREE.Object3D,
	pair: SpatialElementLodPair,
	settings: StageModelSettings
) {
	const frame = new THREE.Group();
	frame.matrixAutoUpdate = false;
	frame.matrix.fromArray(pair.assetToFrame);
	frame.add(source);
	const pose = new THREE.Group();
	pose.rotation.set(
		settings.rotation?.x ?? 0,
		settings.rotation?.y ?? 0,
		settings.rotation?.z ?? 0
	);
	pose.add(frame);
	model.add(pose);
	pose.updateMatrix();
	const excluded = new Set(settings.excludeMeshes ?? []);
	const bounds = pair.bounds
		? new THREE.Box3(
				new THREE.Vector3(...pair.bounds.min),
				new THREE.Vector3(...pair.bounds.max)
			).applyMatrix4(pose.matrix)
		: getMeshBounds(pose, (mesh) => !excluded.has(mesh.name));
	const center = bounds.getCenter(new THREE.Vector3());
	const size = bounds.getSize(new THREE.Vector3());
	const scale = 3 / Math.max(size.x, size.y, size.z, 1);
	model.scale.setScalar(scale);
	model.position.copy(center).multiplyScalar(-scale);
	model.updateMatrix();
	return bounds.applyMatrix4(model.matrix);
}
