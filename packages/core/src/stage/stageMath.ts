import * as THREE from 'three/webgpu';
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import {
	DEFAULT_CAMERA_AZIMUTH,
	DEFAULT_CAMERA_ELEVATION,
	MINIMAP_DEFAULT_MODEL_SCALE,
	PANEL_FOCUS_MAX_ADVANCE,
	PANEL_FOCUS_MAX_BLUR,
	PANEL_FOCUS_MAX_OFFSET,
	PANEL_FOCUS_PERSPECTIVE_MAX_SCALE,
	PANEL_FOCUS_MIN_OPACITY,
	PANEL_POINTER_MAX_TILT,
	PANEL_POINTER_PROXIMITY_ASPECT_LIMIT,
	PANEL_POINTER_PROXIMITY_MAX,
	PANEL_POINTER_PROXIMITY_MIN,
	PANEL_POINTER_PROXIMITY_SCALE,
	VIEW_RESET_MAX_DURATION,
	VIEW_RESET_MIN_DURATION
} from './stageConstants.js';

/** Resolves declarative orbit angles to a normalized direction from product to camera. */
export function getCameraOrbitDirection(azimuth?: number, elevation?: number) {
	const safeAzimuth = Number.isFinite(azimuth) ? (azimuth as number) : DEFAULT_CAMERA_AZIMUTH;
	const safeElevation = THREE.MathUtils.clamp(
		Number.isFinite(elevation) ? (elevation as number) : DEFAULT_CAMERA_ELEVATION,
		-89,
		89
	);
	const azimuthRadians = THREE.MathUtils.degToRad(safeAzimuth);
	const elevationRadians = THREE.MathUtils.degToRad(safeElevation);
	const horizontalScale = Math.cos(elevationRadians);

	return new THREE.Vector3(
		Math.sin(azimuthRadians) * horizontalScale,
		Math.sin(elevationRadians),
		Math.cos(azimuthRadians) * horizontalScale
	).normalize();
}

/** Resolves orbit angles to the world-space orientation of a camera looking at the product. */
export function getCameraOrbitQuaternion(azimuth?: number, elevation?: number) {
	const direction = getCameraOrbitDirection(azimuth, elevation);
	const lookAtMatrix = new THREE.Matrix4().lookAt(
		direction,
		new THREE.Vector3(),
		new THREE.Vector3(0, 1, 0)
	);
	return new THREE.Quaternion().setFromRotationMatrix(lookAtMatrix);
}

/** Applies the cubic Hermite smoothstep curve with clamped endpoints. */
export function smoothstep(edge0: number, edge1: number, value: number) {
	if (edge0 === edge1) return value < edge0 ? 0 : 1;
	const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

/** Lets close-up resets travel longer while keeping small corrections responsive. */
export function getViewResetDuration(focus: number) {
	return THREE.MathUtils.lerp(
		VIEW_RESET_MIN_DURATION,
		VIEW_RESET_MAX_DURATION,
		smoothstep(0, 1, focus)
	);
}

/** Provides a zero-velocity start and finish for the fitted-view return. */
export function getViewResetInterpolation(elapsed: number, duration: number) {
	return smoothstep(0, Math.max(duration, Number.EPSILON), elapsed);
}

/**
 * Remaps camera focus to the earlier UI-clearance phase.
 *
 * Page content and ordinary panels deliberately clear before the minimap grows,
 * preventing the expanding minimap from colliding with nearby interface elements.
 */
export function getStageUiFocus(focus: number) {
	return smoothstep(0.02, 0.82, focus);
}

/**
 * Remaps camera focus to the short, delayed minimap phase.
 *
 * The minimap remains thumbnail-sized while the surrounding interface begins to
 * clear, then reaches its complete expanded size at 78% camera focus.
 */
export function getMinimapFocus(focus: number) {
	return smoothstep(0.22, 0.78, focus);
}

/**
 * Gates minimap expansion behind the UI-clearance phase.
 *
 * Both values originate from the same smoothed camera focus. The gate retains the
 * intentional lead of ordinary content without adding another temporal lag.
 */
export function getSequencedMinimapFocus(focus: number, uiFocus: number) {
	const clearance = smoothstep(0.14, 0.46, uiFocus);
	return getMinimapFocus(focus) * clearance;
}

/**
 * Moves an expanding minimap from its authored panel position to a viewport inset.
 * A zero focus returns the exact resting position; a full focus pins its top-left
 * corner to the requested inset independently of the expanded dimensions.
 */
export function getMinimapFocusPositionOffset(
	basePosition: { x: number; y: number },
	baseSize: { width: number; height: number },
	visualSize: { width: number; height: number },
	viewportSize: { width: number; height: number },
	focus: number,
	inset: number
) {
	const progress = THREE.MathUtils.clamp(focus, 0, 1);
	const baseCenterX = viewportSize.width * 0.5 + basePosition.x;
	const baseCenterY = viewportSize.height * 0.5 - basePosition.y;
	const restingLeft = baseCenterX - baseSize.width * 0.5;
	const restingTop = baseCenterY - baseSize.height * 0.5;
	const focusedLeft = THREE.MathUtils.lerp(restingLeft, inset, progress);
	const focusedTop = THREE.MathUtils.lerp(restingTop, inset, progress);

	return {
		x: focusedLeft + visualSize.width * 0.5 - baseCenterX,
		y: baseCenterY - (focusedTop + visualSize.height * 0.5)
	};
}

/** Normalizes browser wheel units to the pixel-based delta used by OrbitControls. */
export function normalizeWheelZoomDelta(deltaY: number, deltaMode: number, ctrlKey: boolean) {
	let normalizedDelta = deltaY;
	if (deltaMode === 1) normalizedDelta *= 16;
	if (deltaMode === 2) normalizedDelta *= 100;
	if (ctrlKey) normalizedDelta *= 10;
	return normalizedDelta;
}

/** Accumulates an OrbitControls-compatible wheel gesture into a clamped zoom target. */
export function getWheelZoomTargetDistance(
	currentTargetDistance: number,
	deltaY: number,
	zoomSpeed: number,
	minDistance: number,
	maxDistance: number
) {
	const currentDistance = THREE.MathUtils.clamp(currentTargetDistance, minDistance, maxDistance);
	if (!Number.isFinite(deltaY) || deltaY === 0) return currentDistance;

	const scale = Math.pow(0.95, Math.max(zoomSpeed, 0) * Math.abs(deltaY * 0.01));
	const targetDistance = deltaY < 0 ? currentDistance * scale : currentDistance / scale;
	return THREE.MathUtils.clamp(targetDistance, minDistance, maxDistance);
}

/** Resolves the authored minimap scale without imposing an upper creative limit. */
export function resolveMinimapModelScale(
	modelScale?: number,
	fallback = MINIMAP_DEFAULT_MODEL_SCALE
) {
	const safeFallback = Number.isFinite(fallback)
		? Math.max(fallback, 0.2)
		: MINIMAP_DEFAULT_MODEL_SCALE;
	if (modelScale === undefined) return safeFallback;
	if (!Number.isFinite(modelScale)) return safeFallback;
	return Math.max(modelScale, 0.2);
}

/** Blends the configured model multiplier through the damped minimap hover state. */
export function getMinimapHoverScale(hoverModelScale: number, pointerReveal: number) {
	return THREE.MathUtils.lerp(1, hoverModelScale, THREE.MathUtils.clamp(pointerReveal, 0, 1));
}

/**
 * Returns the same opacity used by ordinary panels during close-up focus.
 *
 * Keeping DOM content and panel opacity on one curve prevents either layer from
 * disappearing first while the phase-delayed minimap begins to grow.
 */
export function getStageDomFocusOpacity(uiFocus: number) {
	return getPanelFocusOpacity(uiFocus);
}

/**
 * Defines the camera-distance interval used by the shared close-up focus effect.
 * Starting near the fitted view gives panels and page content enough travel to
 * clear progressively before the product fills the viewport.
 */
export function getZoomFocusDistanceRange(maxDistance: number, modelRadius: number) {
	const restDistance = maxDistance * 0.84;
	let closeDistance = Math.max(modelRadius * 0.14, maxDistance * 0.1);
	if (closeDistance >= restDistance) closeDistance = restDistance * 0.32;

	return { closeDistance, restDistance };
}

/**
 * Converts camera-to-target distance into a FOV-independent visual distance.
 * This keeps focus effects and zoom limits coherent when a SpaceMouse changes
 * perspective FOV while ordinary OrbitControls continue to dolly the camera.
 */
export function getEffectiveCameraDistance(
	distance: number,
	currentFov: number,
	referenceFov: number
) {
	const safeCurrentFov = THREE.MathUtils.clamp(currentFov, 0.01, 179);
	const safeReferenceFov = THREE.MathUtils.clamp(referenceFov, 0.01, 179);
	return (
		distance *
		(Math.tan(THREE.MathUtils.degToRad(safeCurrentFov * 0.5)) /
			Math.tan(THREE.MathUtils.degToRad(safeReferenceFov * 0.5)))
	);
}

/** Maps dolly and perspective-FOV zoom to the same normalized product focus. */
export function getCameraZoomFocus(
	distance: number,
	currentFov: number,
	referenceFov: number,
	closeDistance: number,
	restDistance: number
) {
	return (
		1 -
		smoothstep(
			closeDistance,
			restDistance,
			getEffectiveCameraDistance(distance, currentFov, referenceFov)
		)
	);
}

/**
 * Chooses the distance that best represents the product's visible magnification.
 * OrbitControls reduces its target distance, while 3DxWare may dolly camera and
 * target together and only reduce the distance to the product itself.
 */
export function getCameraZoomReferenceDistance(
	viewTargetDistance: number,
	productCenterDistance: number
) {
	return Math.min(viewTargetDistance, productCenterDistance);
}

/** Returns the perspective camera distance that maps viewport pixels to world units. */
export function getPerspectiveDistance(viewportHeight: number, fov: number) {
	return (viewportHeight * 0.5) / Math.tan(THREE.MathUtils.degToRad(fov * 0.5));
}

/**
 * Places an untransformed panel around its stage-space center and aligns its
 * top-left corner to the device pixel grid for crisp native DOM text.
 */
export function getNativePanelDomPosition(
	center: { x: number; y: number },
	size: { width: number; height: number },
	viewport: { width: number; height: number },
	devicePixelRatio = 1
) {
	const pixelRatio =
		Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
	const snap = (value: number) => Math.round(value * pixelRatio) / pixelRatio;

	return {
		left: snap(viewport.width * 0.5 + center.x - size.width * 0.5),
		top: snap(viewport.height * 0.5 - center.y - size.height * 0.5)
	};
}

/**
 * Compensates an x/y panel anchor when it advances toward a perspective camera.
 *
 * Without this correction, a panel appears to drift away from its DOM anchor as its
 * z position changes.
 */
export function getPerspectiveAnchoredPanelPosition(
	targetX: number,
	targetY: number,
	currentZ: number,
	cameraDistance: number
) {
	const safeCameraDistance = Math.max(cameraDistance, 1);
	const depthScale = THREE.MathUtils.clamp(
		(safeCameraDistance - currentZ) / safeCameraDistance,
		0.05,
		2
	);

	return { x: targetX * depthScale, y: targetY * depthScale };
}

/**
 * Restores the outward screen-space drift that an off-axis panel would receive
 * from the shared perspective while leaving its hover projection panel-local.
 */
export function getPanelFocusPerspectiveOffset(
	position: { x: number; y: number },
	advance: number,
	cameraDistance: number
) {
	const safeCameraDistance = Math.max(Number.isFinite(cameraDistance) ? cameraDistance : 1, 1);
	const safeAdvance = Math.max(Number.isFinite(advance) ? advance : 0, 0);
	if (safeAdvance <= 0) return { x: 0, y: 0 };

	const projectionScale = THREE.MathUtils.clamp(
		safeCameraDistance / Math.max(safeCameraDistance - safeAdvance, 1),
		1,
		PANEL_FOCUS_PERSPECTIVE_MAX_SCALE
	);
	const egressScale = projectionScale - 1;

	return {
		x: position.x * egressScale,
		y: position.y * egressScale
	};
}

/**
 * Builds a local projection root for a panel rendered by the shared stage camera.
 *
 * The translation keeps the panel anchored while it moves in depth. The z shear
 * cancels the shared camera's off-axis perspective, so rotated children converge
 * on the panel center instead of the viewport center.
 */
export function setPanelLocalPerspectiveMatrix(
	target: THREE.Matrix4,
	targetX: number,
	targetY: number,
	currentZ: number,
	cameraDistance: number
) {
	const safeCameraDistance = Math.max(cameraDistance, 1);
	const anchoredPosition = getPerspectiveAnchoredPanelPosition(
		targetX,
		targetY,
		currentZ,
		safeCameraDistance
	);

	return target.set(
		1,
		0,
		-targetX / safeCameraDistance,
		anchoredPosition.x,
		0,
		1,
		-targetY / safeCameraDistance,
		anchoredPosition.y,
		0,
		0,
		1,
		currentZ,
		0,
		0,
		0,
		1
	);
}

/**
 * Calculates the nearest camera distance that contains an oriented bounding box.
 *
 * @param bounds - World-space bounds of the object to frame.
 * @param viewDirection - Direction from the target toward the camera.
 * @param camera - Camera whose FOV and aspect define the frame.
 * @param margin - Multiplicative padding around the fitted object.
 * @param viewportScale - Fraction of the browser viewport available to the product.
 */
export function getCameraFitDistance(
	bounds: THREE.Box3,
	viewDirection: THREE.Vector3,
	camera: THREE.PerspectiveCamera,
	margin = 1,
	viewportScale = { x: 1, y: 1 }
) {
	const corners = getBoxCorners(bounds);
	const center = bounds.getCenter(new THREE.Vector3());
	const forward = viewDirection.clone().normalize().negate();
	const right = new THREE.Vector3().crossVectors(camera.up, forward).normalize();
	if (right.lengthSq() < 0.0001) right.set(1, 0, 0);
	const up = new THREE.Vector3().crossVectors(forward, right).normalize();
	let halfWidth = 0;
	let halfHeight = 0;

	corners.forEach((corner) => {
		const offset = corner.sub(center);
		halfWidth = Math.max(halfWidth, Math.abs(offset.dot(right)));
		halfHeight = Math.max(halfHeight, Math.abs(offset.dot(up)));
	});

	const verticalFov = THREE.MathUtils.degToRad(camera.fov);
	const horizontalFov = 2 * Math.atan(Math.tan(verticalFov * 0.5) * camera.aspect);
	const distanceForHeight = halfHeight / (Math.tan(verticalFov * 0.5) * viewportScale.y);
	const distanceForWidth = halfWidth / (Math.tan(horizontalFov * 0.5) * viewportScale.x);

	return Math.max(distanceForHeight, distanceForWidth, 0.1) * margin;
}

/** Returns the eight corners of an axis-aligned bounding box. */
export function getBoxCorners(bounds: THREE.Box3) {
	const { min, max } = bounds;
	return [
		new THREE.Vector3(min.x, min.y, min.z),
		new THREE.Vector3(min.x, min.y, max.z),
		new THREE.Vector3(min.x, max.y, min.z),
		new THREE.Vector3(min.x, max.y, max.z),
		new THREE.Vector3(max.x, min.y, min.z),
		new THREE.Vector3(max.x, min.y, max.z),
		new THREE.Vector3(max.x, max.y, min.z),
		new THREE.Vector3(max.x, max.y, max.z)
	];
}

/** Computes the camera-facing travel used to clear panels during close-up zoom. */
export function getPanelFocusOffset(
	options: Required<LiquidGlassPanelOptions>,
	focus: number,
	viewportWidth: number,
	viewportHeight: number
) {
	if (focus <= 0.001) return { x: 0, y: 0, z: 0 };
	const edgeDistanceX = Math.max(viewportWidth * 0.5 - options.width * 0.5, 1);
	const edgeDistanceY = Math.max(viewportHeight * 0.5 - options.height * 0.5, 1);
	const normalizedX = options.position.x / edgeDistanceX;
	const normalizedY = options.position.y / edgeDistanceY;
	const direction = getPanelFocusDirection(options, normalizedX, normalizedY);
	const horizontal = Math.abs(direction.x) > Math.abs(direction.y);
	const axisSize = horizontal ? options.width : options.height;
	const travel = THREE.MathUtils.clamp(
		axisSize * (horizontal ? 0.16 : 0.42),
		horizontal ? 48 : 18,
		PANEL_FOCUS_MAX_OFFSET
	);
	const easedFocus = smoothstep(0.12, 1, focus);
	return {
		x: direction.x * travel * easedFocus,
		y: direction.y * travel * easedFocus,
		z: PANEL_FOCUS_MAX_ADVANCE * easedFocus
	};
}

/** Chooses the least disruptive edge toward which a focused panel should travel. */
export function getPanelFocusDirection(
	options: Required<LiquidGlassPanelOptions>,
	normalizedX: number,
	normalizedY: number
) {
	const aspect = options.width / Math.max(options.height, 1);
	const absX = Math.abs(normalizedX);
	const absY = Math.abs(normalizedY);
	if (aspect >= 2.4 && absY > 0.12) return new THREE.Vector2(0, Math.sign(normalizedY) || 1);
	if (absX > absY * 0.8) return new THREE.Vector2(Math.sign(normalizedX) || 1, 0);
	if (absY > absX * 0.8) return new THREE.Vector2(0, Math.sign(normalizedY) || 1);
	const direction = new THREE.Vector2(normalizedX, normalizedY);
	if (direction.lengthSq() < 0.02) direction.set(0, options.position.y >= 0 ? 1 : -1);
	return direction.normalize();
}

/** Returns panel opacity at a normalized stage focus level. */
export function getPanelFocusOpacity(focus: number) {
	return THREE.MathUtils.lerp(1, PANEL_FOCUS_MIN_OPACITY, smoothstep(0.08, 0.96, focus));
}

/** Returns CSS content blur at a normalized stage focus level. */
export function getPanelFocusBlur(focus: number, options: Required<LiquidGlassPanelOptions>) {
	const shortSide = Math.max(Math.min(options.width, options.height), 1);
	const sizeScale = THREE.MathUtils.clamp(Math.sqrt(shortSide / 240), 0.34, 1);
	return PANEL_FOCUS_MAX_BLUR * sizeScale * smoothstep(0.08, 0.96, focus);
}

/**
 * Reduces only the rotation axis amplified by an elongated panel.
 * Square panels keep the full response on both axes.
 */
export function getPanelAspectTiltScale(width: number, height: number) {
	const safeWidth = Math.max(width, 1);
	const safeHeight = Math.max(height, 1);

	return {
		azimuth: Math.min(1, Math.sqrt(safeHeight / safeWidth)),
		elevation: Math.min(1, Math.sqrt(safeWidth / safeHeight))
	};
}

/** Returns the independent approach band for one panel. */
export function getPanelPointerProximity(width: number, height: number) {
	const safeWidth = Math.max(width, 1);
	const safeHeight = Math.max(height, 1);
	const shortSide = Math.min(safeWidth, safeHeight);
	const longSide = Math.max(safeWidth, safeHeight);
	const aspectCorrection = Math.min(
		Math.sqrt(longSide / shortSide),
		PANEL_POINTER_PROXIMITY_ASPECT_LIMIT
	);
	return THREE.MathUtils.clamp(
		shortSide * PANEL_POINTER_PROXIMITY_SCALE * aspectCorrection,
		PANEL_POINTER_PROXIMITY_MIN,
		PANEL_POINTER_PROXIMITY_MAX
	);
}

/** Converts distance from a panel edge into a smooth zero-to-one hover influence. */
export function getPanelPointerInfluence(distance: number, width: number, height: number) {
	return 1 - smoothstep(0, getPanelPointerProximity(width, height), Math.max(distance, 0));
}

/** Resolves a pointer-relative pose with axis-specific aspect-ratio attenuation. */
export function getPanelPointerRotation(
	lookX: number,
	lookY: number,
	influence: number,
	width: number,
	height: number
) {
	const tilt = PANEL_POINTER_MAX_TILT * THREE.MathUtils.clamp(influence, 0, 1);
	const aspectScale = getPanelAspectTiltScale(width, height);
	return {
		x: -THREE.MathUtils.clamp(lookY, -1, 1) * tilt * aspectScale.elevation,
		y: -THREE.MathUtils.clamp(lookX, -1, 1) * tilt * aspectScale.azimuth
	};
}

/** Detects panel geometry changes that require a WebGPU mesh rebuild. */
export function hasPanelGeometryChanged(
	current: Required<LiquidGlassPanelOptions>,
	next: LiquidGlassPanelOptions
) {
	return (
		Math.abs(current.width - (next.width ?? current.width)) > 0.5 ||
		Math.abs(current.height - (next.height ?? current.height)) > 0.5 ||
		Math.abs(current.radius - (next.radius ?? current.radius)) > 0.5
	);
}
