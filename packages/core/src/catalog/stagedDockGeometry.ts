import * as THREE from 'three/webgpu';
import { resolveDetailLayout, type ResponsiveLayoutInput } from '../spatial-element/responsiveLayout.js';
import { getDockedMinimapModelScale } from '../spatial-element/spatialElementDock.js';
import type { StagePanelMinimapOptions } from '../stage/panelContext.js';
import type { StageCameraSettings } from '../stage/stageTypes.js';
import { MINIMAP_PANEL_Z, PANEL_CAMERA_FOV } from '../stage/stageConstants.js';
import { getCameraOrbitQuaternion, getPerspectiveDistance } from '../stage/stageMath.js';
import { getMinimapDepthRange } from '../stage/minimap/MinimapProjection.js';
import {
	getMinimapDockedQuaternion, getMinimapModelFitScale, getMinimapModelRadius, getMinimapRestQuaternion
} from '../stage/minimap/MinimapModelGeometry.js';

/** Explicit route contract; a hash alone never creates this intent. */
export interface StagedDockTargetOptions {
	kind: 'dock';
	layout: ResponsiveLayoutInput;
	minimap?: StagePanelMinimapOptions;
}

export interface StagedDockGeometryInput {
	/** Stable layout metrics, including safe-area and classic scrollbar insets. */
	layout: ResponsiveLayoutInput;
	/** Actual renderer viewport; it may differ from stable layout height during browser chrome changes. */
	viewport: { width: number; height: number };
	/** Actual included Low-mesh bounds after canonical import, authored pose and normalization. */
	lowBounds: THREE.Box3;
	/** Canonical model-root matrix, before catalog interaction/placement. Children already contain authored rotation. */
	modelMatrix: THREE.Matrix4;
	/** Shared detail/LOD pivot. It need not equal the center of the actual Low bounds. */
	center: THREE.Vector3;
	camera: StageCameraSettings;
	/** Element minimap options merged with the known theme, as for the mounted media rail. */
	minimap?: StagePanelMinimapOptions;
	coordinateSystem?: THREE.PerspectiveCamera['coordinateSystem'];
}

/**
 * CPU descriptor for the neutral, fully docked minimap. No DOM, scene, mesh,
 * material, render target or GPU work is created. The caller owns eligibility:
 * this does not establish that an arbitrary destination hash is a docked view.
 *
 * Sensor, pointer hover, camera focus and panel tilt are neutral at arrival.
 * Real 3XL split layouts return undefined: their destination remains the main
 * fixed stage and pane header, rather than a compact minimap.
 */
export function createStagedDockGeometry(input: StagedDockGeometryInput) {
	const { viewport, lowBounds, modelMatrix, center, minimap = {} } = input;
	if (![viewport.width, viewport.height].every(value => Number.isFinite(value) && value > 0) ||
		lowBounds.isEmpty() || ![...lowBounds.min.toArray(), ...lowBounds.max.toArray(),
			...center.toArray(), ...modelMatrix.elements].every(Number.isFinite) || modelMatrix.determinant() === 0) return undefined;
	const dock = resolveDetailLayout(input.layout).dock;
	if (!dock || dock.minimap.width <= 0 || dock.minimap.height <= 0) return undefined;
	const modelRadius = getMinimapModelRadius(lowBounds, center);
	// DockController exposes this value through a three-decimal presentation attribute.
	// Default 1 is explicit there; the helper's automatic header-ratio fallback is not used.
	const presentationScale = Number(getDockedMinimapModelScale(
		{ ...dock.minimap, left: dock.minimap.x, top: dock.minimap.y },
		{ ...dock.surface, left: dock.surface.x, top: dock.surface.y },
		Number.isFinite(minimap.dockedView?.scale) ? minimap.dockedView!.scale : 1).toFixed(3));
	const scale = getMinimapModelFitScale(dock.minimap.width, dock.minimap.height, modelRadius,
		minimap, presentationScale);
	const restModel = new THREE.Quaternion();
	modelMatrix.decompose(new THREE.Vector3(), restModel, new THREE.Vector3());
	const quaternion = getMinimapDockedQuaternion(minimap.dockedView, input.camera, restModel) ??
		getMinimapRestQuaternion(getCameraOrbitQuaternion(input.camera.azimuth, input.camera.elevation), restModel);
	const panelCenter = new THREE.Vector3(
		dock.minimap.x + dock.minimap.width / 2 - viewport.width / 2,
		viewport.height / 2 - dock.minimap.y - dock.minimap.height / 2,
		0
	);
	const panelDistance = getPerspectiveDistance(viewport.height, PANEL_CAMERA_FOV);
	const depth = getMinimapDepthRange([
		{ distance: panelDistance, radius: Math.hypot(dock.minimap.width, dock.minimap.height) / 2 },
		{ distance: panelDistance - MINIMAP_PANEL_Z, radius: modelRadius * scale }
	]);
	const camera = new THREE.PerspectiveCamera(PANEL_CAMERA_FOV, viewport.width / viewport.height, depth.near, depth.far);
	camera.coordinateSystem = input.coordinateSystem ?? THREE.WebGPUCoordinateSystem;
	camera.position.set(panelCenter.x, panelCenter.y, panelDistance);
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld();
	// Same off-axis full-viewport frustum as MinimapController.syncMinimapProjection.
	camera.projectionMatrix.elements[8] = -panelCenter.x * 2 / viewport.width;
	camera.projectionMatrix.elements[9] = -panelCenter.y * 2 / viewport.height;
	camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
	const model = new THREE.Object3D();
	model.matrixAutoUpdate = false;
	model.matrix.compose(panelCenter.clone().setZ(MINIMAP_PANEL_Z), quaternion, new THREE.Vector3(scale, scale, scale))
		.multiply(new THREE.Matrix4().makeTranslation(-center.x, -center.y, -center.z))
		.multiply(modelMatrix);
	model.updateMatrixWorld(true);
	if (![...model.matrix.elements, ...camera.projectionMatrix.elements].every(Number.isFinite)) return undefined;
	return { camera, model, framing: { dock, modelRadius, scale, quaternion, presentationScale } };
}
