import * as ScalarMath from './scalarMath.js';
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import {
	PANEL_FOCUS_PERSPECTIVE_MAX_SCALE,
	PANEL_FOCUS_MAX_OFFSET,
	PANEL_FOCUS_MAX_ADVANCE,
	PANEL_FOCUS_MIN_OPACITY,
	PANEL_FOCUS_MAX_BLUR
} from './stageConstants.js';

/** Applies the cubic Hermite smoothstep curve with clamped endpoints. */
export function smoothstep(edge0: number, edge1: number, value: number) {
	if (edge0 === edge1) return value < edge0 ? 0 : 1;
	const t = ScalarMath.clamp((value - edge0) / (edge1 - edge0), 0, 1);
	return t * t * (3 - 2 * t);
}

/** Returns the perspective camera distance that maps viewport pixels to world units. */
export function getPerspectiveDistance(viewportHeight: number, fov: number) {
	return (viewportHeight * 0.5) / Math.tan(ScalarMath.degToRad(fov * 0.5));
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

	const projectionScale = ScalarMath.clamp(
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

/** Computes the camera-facing travel used to clear panels during close-up zoom. */
export function getPanelFocusOffset(
	options: Pick<Required<LiquidGlassPanelOptions>, 'width' | 'height' | 'position'>,
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
	const travel = ScalarMath.clamp(
		axisSize * (horizontal ? 0.16 : 0.42),
		horizontal ? 48 : 18,
		PANEL_FOCUS_MAX_OFFSET
	);
	const easedFocus = getPanelFocusProgress(focus);
	return {
		x: direction.x * travel * easedFocus,
		y: direction.y * travel * easedFocus,
		z: PANEL_FOCUS_MAX_ADVANCE * easedFocus
	};
}

/** Chooses the least disruptive edge toward which a focused panel should travel. */
export function getPanelFocusDirection(
	options: Pick<Required<LiquidGlassPanelOptions>, 'width' | 'height' | 'position'>,
	normalizedX: number,
	normalizedY: number
) {
	const aspect = options.width / Math.max(options.height, 1);
	const absX = Math.abs(normalizedX);
	const absY = Math.abs(normalizedY);
	if (aspect >= 2.4 && absY > 0.12) return { x: 0, y: Math.sign(normalizedY) || 1 };
	if (absX > absY * 0.8) return { x: Math.sign(normalizedX) || 1, y: 0 };
	if (absY > absX * 0.8) return { x: 0, y: Math.sign(normalizedY) || 1 };
	if (normalizedX * normalizedX + normalizedY * normalizedY < 0.02)
		return { x: 0, y: options.position.y >= 0 ? 1 : -1 };
	const length = Math.hypot(normalizedX, normalizedY);
	return { x: normalizedX / length, y: normalizedY / length };
}

/** Shared, eased progress for panel motion, blur, opacity and corner controls. */
export function getPanelFocusProgress(focus: number) {
	return smoothstep(0.08, 0.96, focus);
}

/** Inverse of the shared curve, for a timeline that already owns eased progress. */
export function getPanelFocusFromProgress(progress: number) {
	if (progress <= 0) return 0;
	if (progress >= 1) return 1;
	return 0.08 + 0.88 * (0.5 - Math.sin(Math.asin(1 - 2 * progress) / 3));
}

/** Stacked detail content leaves as one row, without sideways perspective drift. */
export function getStackedDetailFocusOffset(focus: number, viewportHeight: number) {
	return { x: 0, y: -viewportHeight * 0.6 * getPanelFocusProgress(focus), z: 0 };
}

/** Returns panel opacity at a normalized stage UI focus level. */
export function getPanelFocusOpacity(focus: number) {
	return ScalarMath.lerp(1, PANEL_FOCUS_MIN_OPACITY, getPanelFocusProgress(focus));
}

/** Returns CSS content blur at a normalized stage focus level. */
export function getPanelFocusBlur(
	focus: number,
	options: Pick<Required<LiquidGlassPanelOptions>, 'width' | 'height'>
) {
	const shortSide = Math.max(Math.min(options.width, options.height), 1);
	const sizeScale = ScalarMath.clamp(Math.sqrt(shortSide / 240), 0.34, 1);
	return PANEL_FOCUS_MAX_BLUR * sizeScale * getPanelFocusProgress(focus);
}
