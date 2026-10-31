import * as THREE from 'three/webgpu';
import { getCameraFitDistance, getCameraOrbitDirection } from '../stage/stageMath.js';
import { SPATIAL_ELEMENT_CAMERA_FIT_MARGIN } from '../stage/stageConstants.js';
import type { StageCameraSettings } from '../stage/stageTypes.js';
import type { LayoutRect } from '../spatial-element/responsiveLayout.js';

/** Fit arithmetic shared by the mounted detail and a prepared Low actor before routing. */
export function detailCameraFit(
	bounds: THREE.Box3, camera: THREE.PerspectiveCamera, settings: StageCameraSettings,
	viewport: { width: number; height: number }, fit: Pick<LayoutRect, 'width' | 'height'>
) {
	const width = Math.max(viewport.width, 1), height = Math.max(viewport.height, 1);
	const fitWidth = Math.min(fit.width, width), fitHeight = Math.min(fit.height, height);
	const maximumPadding = Math.max(Math.min(fitWidth, fitHeight) / 2 - 1, 0);
	const padding = THREE.MathUtils.clamp(settings.fitPadding ?? 0, 0, maximumPadding);
	const scale = { x: THREE.MathUtils.clamp((fitWidth - padding * 2) / width, 0.08, 1),
		y: THREE.MathUtils.clamp((fitHeight - padding * 2) / height, 0.08, 1) };
	const direction = getCameraOrbitDirection(settings.azimuth, settings.elevation);
	const sphere = bounds.getBoundingSphere(new THREE.Sphere());
	const radius = Math.max(sphere.radius, 1);
	const distance = Math.max(radius * 0.6, getCameraFitDistance(bounds, direction, camera,
		SPATIAL_ELEMENT_CAMERA_FIT_MARGIN, scale) / THREE.MathUtils.clamp(settings.fitScale ?? 1, 0.2, 4));
	return { direction, center: sphere.center, radius, distance,
		near: Math.max(distance / 100, 0.01), far: Math.max(distance * 100, radius * 20) };
}

/** Pure CPU camera/model descriptors; this creates no scene, material, buffer or GPU pipeline. */
export function createStagedDetailGeometry(
	bounds: THREE.Box3, modelMatrix: THREE.Matrix4, settings: StageCameraSettings,
	viewport: { width: number; height: number }, fit: LayoutRect
) {
	const camera = new THREE.PerspectiveCamera(45, viewport.width / viewport.height, 0.01, 100);
	camera.coordinateSystem = THREE.WebGPUCoordinateSystem;
	const framing = detailCameraFit(bounds, camera, settings, viewport, fit);
	camera.position.copy(framing.center).addScaledVector(framing.direction, framing.distance);
	camera.near = framing.near; camera.far = framing.far;
	camera.lookAt(framing.center);
	// Mounted DETAIL fits against the full box but centers its camera in the
	// visible clipped viewport. Minimum hero heights can extend below short screens.
	const left = THREE.MathUtils.clamp(fit.x, 0, viewport.width);
	const top = THREE.MathUtils.clamp(fit.y, 0, viewport.height);
	const right = THREE.MathUtils.clamp(fit.x + fit.width, 0, viewport.width);
	const bottom = THREE.MathUtils.clamp(fit.y + fit.height, 0, viewport.height);
	const offsetX = viewport.width / 2 - (left + Math.max(right - left, 1) / 2);
	const offsetY = viewport.height / 2 - (top + Math.max(bottom - top, 1) / 2);
	if (Math.abs(offsetX) > 0.25 || Math.abs(offsetY) > 0.25)
		camera.setViewOffset(viewport.width, viewport.height, offsetX, offsetY, viewport.width, viewport.height);
	else camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	const model = new THREE.Object3D();
	model.matrixAutoUpdate = false;
	model.matrix.copy(modelMatrix); model.updateMatrixWorld();
	return { camera, model, framing };
}
