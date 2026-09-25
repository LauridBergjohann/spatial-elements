import * as THREE from 'three/webgpu';
import type { Object3D } from 'three';

export { getProjectiveCssMatrix3d } from '../cssProjection.js';
export type { CssProjectionPoint, CssProjectionQuad } from '../cssProjection.js';

export interface MinimapDepthBound {
	/** Positive camera-space distance to the bound's center. */
	distance: number;
	/** Camera-space radius that must remain inside the clipping range. */
	radius: number;
}

/**
 * Fits a compact clipping range around the panel and live minimap model.
 *
 * The regular panel camera spans thousands of world units. Reusing that range
 * for thumbnail geometry collapses closely layered product surfaces into the
 * same depth values, so a small pointer tilt can make their fragments alternate.
 */
export function getMinimapDepthRange(
	bounds: readonly MinimapDepthBound[],
	guard = 16,
	minimumNear = 0.01
) {
	const safeGuard = Math.max(Number.isFinite(guard) ? guard : 0, 0);
	const safeMinimumNear = Math.max(Number.isFinite(minimumNear) ? minimumNear : 0.01, 0.000001);
	let near = Number.POSITIVE_INFINITY;
	let far = Number.NEGATIVE_INFINITY;

	bounds.forEach(({ distance, radius }) => {
		if (!Number.isFinite(distance) || distance <= 0) return;
		const safeRadius = Math.max(Number.isFinite(radius) ? radius : 0, 0);
		near = Math.min(near, distance - safeRadius);
		far = Math.max(far, distance + safeRadius);
	});

	if (!Number.isFinite(near) || !Number.isFinite(far)) {
		return { near: safeMinimumNear, far: safeMinimumNear + 1 };
	}

	near = Math.max(near - safeGuard, safeMinimumNear);
	far = Math.max(far + safeGuard, near + 0.01);
	return { near, far };
}

/** Returns the FOV that makes panel-local world units match CSS pixels at a distance. */
export function getPanelLocalCameraFov(panelHeight: number, distance: number) {
	return THREE.MathUtils.radToDeg(
		2 * Math.atan(Math.max(panelHeight, 1) / (Math.max(distance, 1) * 2))
	);
}

/** Rectangle, in panel-local pixels, occupied by the main camera's current view. */
export interface MinimapViewportRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

/**
 * Projects the main camera frustum onto the minimap model's target plane.
 *
 * The conversion intentionally passes through model-local coordinates. This keeps
 * panning and orbiting stable even though the minimap layer itself follows a tilted
 * panel in screen space.
 */
export function getMinimapViewportRect(
	stageCamera: THREE.PerspectiveCamera,
	minimapCamera: THREE.PerspectiveCamera,
	target: THREE.Vector3,
	stageModel: Object3D,
	minimapSourceRoot: Object3D,
	minimapSourceLayer: Object3D,
	width: number,
	height: number
): MinimapViewportRect | null {
	const stageForward = new THREE.Vector3();
	stageCamera.getWorldDirection(stageForward);
	if (stageForward.lengthSq() < 0.0001) return null;

	const targetPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(stageForward, target);
	const stageOrigin = stageCamera.getWorldPosition(new THREE.Vector3());
	const stageRay = new THREE.Ray();
	const hit = new THREE.Vector3();
	const projected: THREE.Vector2[] = [];
	const corners = [
		new THREE.Vector3(-1, -1, 0.5),
		new THREE.Vector3(1, -1, 0.5),
		new THREE.Vector3(1, 1, 0.5),
		new THREE.Vector3(-1, 1, 0.5)
	];

	stageCamera.updateMatrixWorld(true);
	stageModel.updateWorldMatrix(true, true);
	minimapSourceRoot.updateWorldMatrix(true, true);
	minimapSourceLayer.updateWorldMatrix(true, true);
	minimapCamera.updateMatrixWorld(true);

	corners.forEach((corner) => {
		const worldPoint = corner.clone().unproject(stageCamera);
		const direction = worldPoint.sub(stageOrigin).normalize();
		stageRay.set(stageOrigin, direction);
		const intersection = stageRay.intersectPlane(targetPlane, hit);
		if (!intersection) return;

		const modelPoint = stageModel.worldToLocal(intersection.clone());
		const minimapPoint = minimapSourceRoot.localToWorld(modelPoint);
		// The camera is panel-local, so remove the layer's shared screen transform.
		minimapSourceLayer.worldToLocal(minimapPoint);
		const ndc = minimapPoint.project(minimapCamera);
		if (!Number.isFinite(ndc.x) || !Number.isFinite(ndc.y)) return;
		projected.push(new THREE.Vector2(ndc.x * width * 0.5, ndc.y * height * 0.5));
	});

	if (projected.length < 4) return null;
	const minX = Math.min(...projected.map((point) => point.x));
	const maxX = Math.max(...projected.map((point) => point.x));
	const minY = Math.min(...projected.map((point) => point.y));
	const maxY = Math.max(...projected.map((point) => point.y));
	const centerX = (minX + maxX) * 0.5;
	const centerY = (minY + maxY) * 0.5;
	let rectWidth = maxX - minX;
	let rectHeight = maxY - minY;
	if (
		!Number.isFinite(rectWidth) ||
		!Number.isFinite(rectHeight) ||
		rectWidth <= 0 ||
		rectHeight <= 0
	) {
		return null;
	}

	const minSize = 8;
	const minScale = Math.max(minSize / rectWidth, minSize / rectHeight, 1);
	rectWidth *= minScale;
	rectHeight *= minScale;
	const fitScale = Math.min(width / rectWidth, height / rectHeight, 1);
	rectWidth *= fitScale;
	rectHeight *= fitScale;
	const maxCenterX = Math.max((width - rectWidth) * 0.5, 0);
	const maxCenterY = Math.max((height - rectHeight) * 0.5, 0);

	return {
		x: THREE.MathUtils.clamp(centerX, -maxCenterX, maxCenterX),
		y: THREE.MathUtils.clamp(centerY, -maxCenterY, maxCenterY),
		width: rectWidth,
		height: rectHeight
	};
}

/** Normalizes a CSS blur radius before it is passed to the WebGPU blur pipeline. */
export function getMinimapCssBlurRadius(blur: number) {
	return Math.max(blur, 0);
}
