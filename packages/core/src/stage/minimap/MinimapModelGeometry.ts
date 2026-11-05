import * as THREE from 'three/webgpu';
import { MINIMAP_MODEL_FILL } from '../stageConstants.js';
import { getCameraOrbitQuaternion, resolveMinimapModelScale } from '../stageMath.js';
import type { StageCameraSettings, StageMinimapDockedView } from '../stageTypes.js';

/** Low geometry is fitted around the shared LOD pivot, not its own possibly offset center. */
export function getMinimapModelRadius(bounds: THREE.Box3, center: THREE.Vector3) {
	const sphere = bounds.getBoundingSphere(new THREE.Sphere());
	return Math.max(sphere.radius + sphere.center.distanceTo(center), 0.001);
}

/** Resting fit shared by mounted and pre-route minimaps; hover is applied separately. */
export function getMinimapModelFitScale(
	width: number, height: number, modelRadius: number,
	options: { inset?: number; modelScale?: number } = {}, presentationScale = 1
) {
	const inset = Math.max(options.inset ?? 0, 0);
	const diameter = Math.min(Math.max(width - inset * 2, 8), Math.max(height - inset * 2, 8));
	return diameter * MINIMAP_MODEL_FILL * resolveMinimapModelScale(options.modelScale) *
		THREE.MathUtils.clamp(presentationScale, 0.2, 2) / Math.max(modelRadius * 2, 0.001);
}

export function getMinimapRestQuaternion(camera: THREE.Quaternion, model: THREE.Quaternion) {
	return camera.clone().invert().multiply(model);
}

/** Omitted dock angles retain the authored stage view, including an explicitly partial override. */
export function getMinimapDockedQuaternion(
	docked: StageMinimapDockedView | undefined, camera: StageCameraSettings, model: THREE.Quaternion
) {
	if (!Number.isFinite(docked?.azimuth) && !Number.isFinite(docked?.elevation)) return undefined;
	return getCameraOrbitQuaternion(docked?.azimuth ?? camera.azimuth, docked?.elevation ?? camera.elevation)
		.invert().multiply(model);
}

/**
 * Exact translation along a parent's Y axis that puts the projected model top
 * on a viewport row. Solving each corner's homogeneous projection also handles
 * depth, hover enlargement and tilted panels without a screen-space estimate.
 */
export function getMinimapTopAlignmentOffset(
	points: readonly THREE.Vector3[], modelMatrix: THREE.Matrix4, camera: THREE.PerspectiveCamera,
	viewportHeight: number, top: number, parentMatrix = new THREE.Matrix4()
) {
	const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
	const direction = new THREE.Vector4(0, 1, 0, 0).applyMatrix4(parentMatrix).applyMatrix4(projection);
	const transform = projection.multiply(modelMatrix);
	const targetY = 1 - top * 2 / Math.max(viewportHeight, 1);
	const slope = direction.y - targetY * direction.w;
	if (!Number.isFinite(slope) || slope <= 0.000001) return 0;
	const point = new THREE.Vector4();
	let offset = Number.POSITIVE_INFINITY;
	for (const bound of points) {
		point.set(bound.x, bound.y, bound.z, 1).applyMatrix4(transform);
		if (point.w <= 0) continue;
		offset = Math.min(offset, (targetY * point.w - point.y) / slope);
	}
	return Number.isFinite(offset) ? offset : 0;
}
