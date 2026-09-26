import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { PANEL_POINTER_MAX_TILT } from './stageConstants.js';
import {
	getBoxCorners,
	getCameraFitDistance,
	getCameraOrbitDirection,
	getCameraOrbitQuaternion,
	getCameraZoomFocus,
	getCameraZoomReferenceDistance,
	getEffectiveCameraDistance,
	getMinimapFocus,
	getMinimapFocusPositionOffset,
	getWheelZoomTargetDistance,
	getMinimapHoverScale,
	getNativePanelDomPosition,
	getPanelAspectTiltScale,
	getPanelFocusBlur,
	getPanelFocusDirection,
	getPanelFocusOffset,
	getPanelFocusPerspectiveOffset,
	getPanelFocusOpacity,
	getPanelPointerInfluence,
	getPanelPointerProximity,
	getPanelPointerRotation,
	getPerspectiveDistance,
	getPerspectiveAnchoredPanelPosition,
	resolveMinimapModelScale,
	setPanelLocalPerspectiveMatrix,
	getSequencedMinimapFocus,
	getStageDomFocusOpacity,
	getStageUiFocus,
	getViewResetDuration,
	getViewResetInterpolation,
	getZoomFocusDistanceRange,
	hasPanelGeometryChanged,
	normalizeWheelZoomDelta,
	smoothstep
} from './stageMath.js';
import type { LiquidGlassPanelOptions } from './LiquidGlassPanel.js';

const panelOptions = {
	width: 360,
	height: 230,
	radius: 42,
	position: { x: 0, y: 42 }
} as Required<LiquidGlassPanelOptions>;

describe('stage math', () => {
	it('aligns native panel positions to the physical pixel grid', () => {
		expect(
			getNativePanelDomPosition(
				{ x: 120.2, y: -40.2 },
				{ width: 500.5, height: 52.5 },
				{ width: 1440, height: 900 },
				2
			)
		).toEqual({ left: 590, top: 464 });
		expect(
			getNativePanelDomPosition(
				{ x: 0.3, y: 0.3 },
				{ width: 100, height: 100 },
				{ width: 800, height: 600 },
				1
			)
		).toEqual({ left: 350, top: 250 });
	});

	it('keeps authored minimap scales above the former upper limit', () => {
		expect(resolveMinimapModelScale()).toBe(1);
		expect(resolveMinimapModelScale(0.1)).toBe(0.2);
		expect(resolveMinimapModelScale(1.5)).toBe(1.5);
		expect(resolveMinimapModelScale(4)).toBe(4);
		expect(resolveMinimapModelScale(undefined, 1.16)).toBe(1.16);
	});

	it('blends a configurable minimap hover scale', () => {
		expect(getMinimapHoverScale(1.3, 0)).toBe(1);
		expect(getMinimapHoverScale(1.3, 0.5)).toBeCloseTo(1.15);
		expect(getMinimapHoverScale(1.3, 1)).toBe(1.3);
	});

	it('preserves the existing spatialElement camera direction as the default orbit', () => {
		const direction = getCameraOrbitDirection();
		const previousDefault = new THREE.Vector3(0.45, 0.28, 1).normalize();

		expect(direction.distanceTo(previousDefault)).toBeLessThan(0.000001);
	});

	it('resolves configurable left/right and elevation camera angles', () => {
		const fromRight = getCameraOrbitDirection(35, 20);
		const fromLeft = getCameraOrbitDirection(-35, 5);

		expect(fromRight.length()).toBeCloseTo(1);
		expect(fromRight.x).toBeGreaterThan(0);
		expect(fromRight.y).toBeCloseTo(Math.sin(THREE.MathUtils.degToRad(20)));
		expect(fromLeft.x).toBeLessThan(0);
		expect(fromLeft.y).toBeGreaterThan(0);
	});

	it('resolves orbit angles to the matching look-at camera orientation', () => {
		const direction = getCameraOrbitDirection(-20, 20);
		const camera = new THREE.PerspectiveCamera();
		camera.position.copy(direction);
		camera.lookAt(0, 0, 0);

		expect(getCameraOrbitQuaternion(-20, 20).angleTo(camera.quaternion)).toBeLessThan(0.000001);
		expect(
			getCameraOrbitQuaternion(-20, 20).angleTo(getCameraOrbitQuaternion(30, 20))
		).toBeGreaterThan(0.1);
	});

	it('clamps smoothstep and preserves its midpoint', () => {
		expect(smoothstep(0, 1, -1)).toBe(0);
		expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
		expect(smoothstep(0, 1, 2)).toBe(1);
		expect(smoothstep(1, 1, 1)).toBe(1);
	});

	it('slows a fitted-view reset as the zoom depth increases', () => {
		const shallow = getViewResetDuration(0);
		const medium = getViewResetDuration(0.5);
		const deep = getViewResetDuration(1);

		expect(shallow).toBeCloseTo(0.3);
		expect(medium).toBeGreaterThan(shallow);
		expect(deep).toBeCloseTo(0.8);
		expect(getViewResetDuration(-1)).toBe(shallow);
		expect(getViewResetDuration(2)).toBe(deep);
	});

	it('eases a fitted-view reset into and out of its movement', () => {
		expect(getViewResetInterpolation(0, 1)).toBe(0);
		expect(getViewResetInterpolation(0.1, 1)).toBeLessThan(0.1);
		expect(getViewResetInterpolation(0.5, 1)).toBeCloseTo(0.5);
		expect(getViewResetInterpolation(0.9, 1)).toBeGreaterThan(0.9);
		expect(getViewResetInterpolation(1, 1)).toBe(1);
	});

	it('keeps a perspective panel anchored while it advances toward the camera', () => {
		expect(getPerspectiveAnchoredPanelPosition(120, -60, 0, 1000)).toEqual({
			x: 120,
			y: -60
		});
		expect(getPerspectiveAnchoredPanelPosition(120, -60, 250, 1000)).toEqual({
			x: 90,
			y: -45
		});
	});

	it('restores shared-perspective egress only for focus advance', () => {
		const position = { x: 480, y: -240 };
		const rest = getPanelFocusPerspectiveOffset(position, 0, 1200);
		const focused = getPanelFocusPerspectiveOffset(position, 300, 1200);

		expect(rest).toEqual({ x: 0, y: 0 });
		expect(focused.x).toBeCloseTo(160);
		expect(focused.y).toBeCloseTo(-80);
	});

	it('caps focus egress on short perspective distances', () => {
		const focused = getPanelFocusPerspectiveOffset({ x: 400, y: 200 }, 590, 600);

		expect(focused.x).toBeCloseTo(260);
		expect(focused.y).toBeCloseTo(130);
	});

	it('maps the perspective distance back to one world unit per viewport pixel', () => {
		const viewportHeight = 900;
		const fov = 36;
		const distance = getPerspectiveDistance(viewportHeight, fov);
		const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));

		expect(visibleHeight).toBeCloseTo(viewportHeight);
	});

	it('projects an off-axis tilted panel around its own center', () => {
		const cameraDistance = 1200;
		const targetX = 430;
		const targetY = -170;
		const targetZ = 48;
		const rotation = new THREE.Euler(THREE.MathUtils.degToRad(-7), THREE.MathUtils.degToRad(11), 0);
		const localPoint = new THREE.Vector3(140, 90, 0).applyEuler(rotation);
		const localProjection = setPanelLocalPerspectiveMatrix(
			new THREE.Matrix4(),
			targetX,
			targetY,
			targetZ,
			cameraDistance
		);
		const worldPoint = localPoint.clone().applyMatrix4(localProjection);
		const perspectiveScale = cameraDistance / (cameraDistance - worldPoint.z);
		const projectedPoint = new THREE.Vector2(
			worldPoint.x * perspectiveScale,
			worldPoint.y * perspectiveScale
		);
		const expectedLocalScale = cameraDistance / (cameraDistance - targetZ - localPoint.z);

		expect(projectedPoint.x).toBeCloseTo(targetX + localPoint.x * expectedLocalScale);
		expect(projectedPoint.y).toBeCloseTo(targetY + localPoint.y * expectedLocalScale);
	});

	it('increases fit distance when less viewport space is available', () => {
		const bounds = new THREE.Box3(new THREE.Vector3(-2, -1, -0.5), new THREE.Vector3(2, 1, 0.5));
		const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
		const direction = new THREE.Vector3(0, 0, 1);
		const fullFrame = getCameraFitDistance(bounds, direction, camera);
		const constrained = getCameraFitDistance(bounds, direction, camera, 1, {
			x: 0.5,
			y: 0.7
		});

		expect(constrained).toBeGreaterThan(fullFrame);
	});

	it('returns every unique corner of a bounding box', () => {
		const bounds = new THREE.Box3(new THREE.Vector3(-1, -2, -3), new THREE.Vector3(4, 5, 6));
		const corners = getBoxCorners(bounds);
		const keys = new Set(corners.map((corner) => corner.toArray().join(',')));

		expect(corners).toHaveLength(8);
		expect(keys.size).toBe(8);
		expect(keys).toContain('-1,-2,-3');
		expect(keys).toContain('4,5,6');
	});

	it('moves panels toward the least disruptive viewport edge', () => {
		const header = { ...panelOptions, width: 1200, height: 80 };
		const sidePanel = { ...panelOptions, position: { x: 500, y: 30 } };
		const centeredPanel = { ...panelOptions, position: { x: 0, y: 0 } };

		expect(getPanelFocusDirection(header, 0.25, -0.4).toArray()).toEqual([0, -1]);
		expect(getPanelFocusDirection(sidePanel, 0.8, 0.1).toArray()).toEqual([1, 0]);
		expect(getPanelFocusDirection(centeredPanel, 0, 0).toArray()).toEqual([0, 1]);
	});

	it('advances focused panels smoothly toward the camera', () => {
		const rest = getPanelFocusOffset(panelOptions, 0, 1440, 900);
		const middle = getPanelFocusOffset(panelOptions, 0.5, 1440, 900);
		const close = getPanelFocusOffset(panelOptions, 1, 1440, 900);

		expect(rest).toEqual({ x: 0, y: 0, z: 0 });
		expect(middle.z).toBeGreaterThan(0);
		expect(close.z).toBeGreaterThan(middle.z);
		expect(Math.abs(close.y)).toBeGreaterThan(Math.abs(middle.y));
	});

	it('attenuates only the axis amplified by an elongated panel', () => {
		const square = getPanelPointerRotation(-1, -1, 1, 120, 120);
		const wide = getPanelPointerRotation(-1, -1, 1, 480, 120);
		const tall = getPanelPointerRotation(-1, -1, 1, 120, 480);
		const opposite = getPanelPointerRotation(1, 1, 1, 120, 120);
		const halfStrength = getPanelPointerRotation(-1, -1, 0.5, 120, 120);

		expect(THREE.MathUtils.radToDeg(PANEL_POINTER_MAX_TILT)).toBeCloseTo(10);
		expect(square).toEqual({ x: PANEL_POINTER_MAX_TILT, y: PANEL_POINTER_MAX_TILT });
		expect(wide.x).toBeCloseTo(square.x);
		expect(wide.y).toBeCloseTo(square.y * 0.5);
		expect(tall.x).toBeCloseTo(square.x * 0.5);
		expect(tall.y).toBeCloseTo(square.y);
		expect(opposite).toEqual({ x: -PANEL_POINTER_MAX_TILT, y: -PANEL_POINTER_MAX_TILT });
		expect(halfStrength.x).toBeCloseTo(square.x * 0.5);
		expect(halfStrength.y).toBeCloseTo(square.y * 0.5);
		expect(getPanelAspectTiltScale(960, 60).azimuth).toBeCloseTo(0.25);
	});

	it('builds a bounded and continuous approach field from the short panel side', () => {
		expect(getPanelPointerProximity(120, 120)).toBe(90);
		expect(getPanelPointerProximity(1200, 66)).toBeCloseTo(81.675);
		expect(getPanelPointerProximity(480, 52)).toBe(72);
		expect(getPanelPointerProximity(600, 600)).toBe(180);
		expect(getPanelPointerInfluence(90, 120, 120)).toBe(0);
		expect(getPanelPointerInfluence(45, 120, 120)).toBeCloseTo(0.5);
		expect(getPanelPointerInfluence(0, 120, 120)).toBe(1);
	});

	it('fades and blurs panels monotonically as focus increases', () => {
		expect(getPanelFocusOpacity(0)).toBe(1);
		expect(getPanelFocusOpacity(0.2)).toBeLessThan(1);
		expect(getPanelFocusOpacity(0.7)).toBeGreaterThan(getPanelFocusOpacity(1));
		expect(getPanelFocusBlur(0, panelOptions)).toBe(0);
		expect(getPanelFocusBlur(0.7, panelOptions)).toBeLessThan(getPanelFocusBlur(1, panelOptions));
	});

	it('keeps ordinary DOM opacity exactly synchronized with panel opacity', () => {
		for (const uiFocus of [0, 0.05, 0.1, 0.5, 0.9, 1]) {
			expect(getStageDomFocusOpacity(uiFocus)).toBe(getPanelFocusOpacity(uiFocus));
		}
		expect(getStageDomFocusOpacity(0)).toBe(1);
		expect(getStageDomFocusOpacity(0.5)).toBeGreaterThan(0);
		expect(getStageDomFocusOpacity(0.5)).toBeLessThan(1);
		expect(getStageDomFocusOpacity(1)).toBe(0);
	});

	it('clears interface content before expanding the minimap', () => {
		expect(getStageUiFocus(0)).toBe(0);
		expect(getMinimapFocus(0)).toBe(0);
		expect(getStageUiFocus(0.2)).toBeGreaterThan(0);
		expect(getMinimapFocus(0.2)).toBe(0);
		expect(getStageUiFocus(0.4)).toBeGreaterThan(getMinimapFocus(0.4));
		expect(getMinimapFocus(0.3)).toBeGreaterThan(0);
		expect(getMinimapFocus(0.6)).toBeGreaterThan(0);
		expect(getMinimapFocus(0.6)).toBeLessThan(1);
		expect(getMinimapFocus(0.78)).toBe(1);
		expect(getStageUiFocus(1)).toBe(1);
		expect(getMinimapFocus(1)).toBe(1);
	});

	it('gates minimap expansion behind animated UI clearance', () => {
		expect(getSequencedMinimapFocus(0.5, 0.1)).toBe(0);
		expect(getSequencedMinimapFocus(0.5, 0.3)).toBeGreaterThan(0);
		expect(getSequencedMinimapFocus(0.5, 0.3)).toBeLessThan(getMinimapFocus(0.5));
		expect(getSequencedMinimapFocus(0.6, getStageUiFocus(0.6))).toBeLessThan(1);
		expect(getSequencedMinimapFocus(0.78, getStageUiFocus(0.78))).toBe(1);
		expect(getSequencedMinimapFocus(1, 1)).toBe(1);
	});

	it('pins only the fully focused minimap to the requested viewport inset', () => {
		const basePosition = { x: -608, y: 278 };
		const baseSize = { width: 120, height: 120 };
		const viewportSize = { width: 1440, height: 900 };
		const resting = getMinimapFocusPositionOffset(
			basePosition,
			baseSize,
			baseSize,
			viewportSize,
			0,
			10
		);
		const focusedSize = { width: 230, height: 230 };
		const focused = getMinimapFocusPositionOffset(
			basePosition,
			baseSize,
			focusedSize,
			viewportSize,
			1,
			10
		);
		const baseCenterX = viewportSize.width * 0.5 + basePosition.x;
		const baseCenterY = viewportSize.height * 0.5 - basePosition.y;

		expect(resting).toEqual({ x: 0, y: 0 });
		expect(baseCenterX + focused.x - focusedSize.width * 0.5).toBeCloseTo(10);
		expect(baseCenterY - focused.y - focusedSize.height * 0.5).toBeCloseTo(10);
	});

	it('normalizes and accumulates reversible wheel zoom targets', () => {
		const zoomedIn = getWheelZoomTargetDistance(10, -600, 1, 2, 20);
		const zoomedOut = getWheelZoomTargetDistance(zoomedIn, 600, 1, 2, 20);

		expect(normalizeWheelZoomDelta(2, 0, false)).toBe(2);
		expect(normalizeWheelZoomDelta(2, 1, false)).toBe(32);
		expect(normalizeWheelZoomDelta(2, 2, true)).toBe(2000);
		expect(zoomedIn).toBeCloseTo(10 * Math.pow(0.95, 6));
		expect(zoomedOut).toBeCloseTo(10);
		expect(getWheelZoomTargetDistance(2, -600, 1, 2, 20)).toBe(2);
		expect(getWheelZoomTargetDistance(20, 600, 1, 2, 20)).toBe(20);
	});

	it('starts close-up focus near the fitted camera distance', () => {
		const range = getZoomFocusDistanceRange(100, 20);

		expect(range.restDistance).toBeCloseTo(84);
		expect(range.closeDistance).toBeCloseTo(10);
		expect(range.closeDistance).toBeLessThan(range.restDistance);
	});

	it('normalizes visual distance when perspective FOV changes', () => {
		expect(getEffectiveCameraDistance(10, 45, 45)).toBeCloseTo(10);
		expect(getEffectiveCameraDistance(10, 30, 45)).toBeLessThan(10);
		expect(getEffectiveCameraDistance(10, 60, 45)).toBeGreaterThan(10);
	});

	it('gives SpaceMouse FOV zoom and OrbitControls dolly zoom the same UI focus', () => {
		const referenceFov = 45;
		const dollyDistance = 5;
		const cameraDistance = 10;
		const fovZoom = THREE.MathUtils.radToDeg(
			2 *
				Math.atan(
					(Math.tan(THREE.MathUtils.degToRad(referenceFov * 0.5)) * dollyDistance) / cameraDistance
				)
		);

		const orbitFocus = getCameraZoomFocus(dollyDistance, referenceFov, referenceFov, 2, 9);
		const spaceMouseFocus = getCameraZoomFocus(cameraDistance, fovZoom, referenceFov, 2, 9);

		expect(spaceMouseFocus).toBeCloseTo(orbitFocus);
		expect(spaceMouseFocus).toBeGreaterThan(0);
	});

	it('detects a SpaceMouse dolly when camera and view target move together', () => {
		expect(getCameraZoomReferenceDistance(10, 5)).toBe(5);
		expect(getCameraZoomReferenceDistance(5, 5.2)).toBe(5);
	});

	it('rebuilds panel geometry only after a meaningful size or radius change', () => {
		expect(hasPanelGeometryChanged(panelOptions, { width: panelOptions.width + 0.5 })).toBe(false);
		expect(hasPanelGeometryChanged(panelOptions, { height: panelOptions.height + 0.51 })).toBe(
			true
		);
		expect(hasPanelGeometryChanged(panelOptions, { radius: panelOptions.radius - 1 })).toBe(true);
		expect(hasPanelGeometryChanged(panelOptions, { tint: '#000000' })).toBe(false);
	});
});
