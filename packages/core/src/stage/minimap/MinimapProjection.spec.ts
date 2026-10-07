import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import {
	getMinimapDepthRange,
	getMinimapCssBlurRadius,
	getMinimapViewportRect,
	clipMinimapViewportRect,
	getPanelLocalCameraFov,
	getProjectiveCssMatrix3d,
	type CssProjectionQuad
} from './MinimapProjection.js';

function parseCssMatrix(transform: string) {
	return transform.slice('matrix3d('.length, -1).split(',').map(Number);
}

function projectCssPoint(matrix: number[], x: number, y: number) {
	const w = matrix[3] * x + matrix[7] * y + matrix[15];
	return {
		x: (matrix[0] * x + matrix[4] * y + matrix[12]) / w,
		y: (matrix[1] * x + matrix[5] * y + matrix[13]) / w
	};
}

function createCamera(distance: number, aspect = 1) {
	const camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
	camera.position.set(0, 0, distance);
	camera.lookAt(0, 0, 0);
	camera.updateProjectionMatrix();
	camera.updateMatrixWorld(true);
	return camera;
}

function projectViewport(stageDistance: number, layer?: THREE.Group) {
	return projectViewportAtTarget(stageDistance, new THREE.Vector3(), layer);
}

function projectViewportAtTarget(
	stageDistance: number,
	target: THREE.Vector3,
	layer?: THREE.Group
) {
	const stageCamera = createCamera(stageDistance, 16 / 9);
	stageCamera.position.add(target);
	stageCamera.lookAt(target);
	stageCamera.updateMatrixWorld(true);
	const minimapCamera = createCamera(12, 1);
	const stageModel = new THREE.Group();
	const sourceLayer = layer ?? new THREE.Group();
	const sourceRoot = new THREE.Group();
	sourceLayer.add(sourceRoot);

	return getMinimapViewportRect(
		stageCamera,
		minimapCamera,
		target,
		stageModel,
		sourceRoot,
		sourceLayer,
		240,
		240
	);
}

function projectTravelingTarget(projectionTarget: THREE.Vector3) {
	const stageCamera = createCamera(5, 16 / 9);
	const travelingTarget = new THREE.Vector3(0, 0, -5);
	stageCamera.lookAt(travelingTarget);
	stageCamera.updateMatrixWorld(true);
	const minimapCamera = createCamera(12, 1);
	const stageModel = new THREE.Group();
	const sourceLayer = new THREE.Group();
	const sourceRoot = new THREE.Group();
	sourceLayer.add(sourceRoot);

	return getMinimapViewportRect(
		stageCamera,
		minimapCamera,
		projectionTarget,
		stageModel,
		sourceRoot,
		sourceLayer,
		240,
		240
	);
}

describe('minimap projection', () => {
	it('fits a tight depth range around the panel and live spatialElement bounds', () => {
		const range = getMinimapDepthRange(
			[
				{ distance: 1385, radius: 85 },
				{ distance: 1361, radius: 62 }
			],
			16
		);

		expect(range.near).toBe(1283);
		expect(range.far).toBe(1486);
		expect(range.far / range.near).toBeLessThan(1.2);
	});

	it('keeps malformed bounds from producing an invalid camera frustum', () => {
		expect(getMinimapDepthRange([])).toEqual({ near: 0.01, far: 1.01 });
		expect(
			getMinimapDepthRange([
				{ distance: Number.NaN, radius: 10 },
				{ distance: 10, radius: Number.NaN }
			])
		).toEqual({ near: 0.01, far: 26 });
	});

	it('maps a DOM rectangle onto the WebGPU panel projection', () => {
		const width = 240;
		const height = 200;
		const corners = [
			{ x: 30, y: 40 },
			{ x: 280, y: 28 },
			{ x: 260, y: 240 },
			{ x: 42, y: 220 }
		] as const satisfies CssProjectionQuad;
		const transform = getProjectiveCssMatrix3d(corners, width, height);

		expect(transform).not.toBeNull();
		const matrix = parseCssMatrix(transform ?? '');
		const projected = [
			projectCssPoint(matrix, 0, 0),
			projectCssPoint(matrix, width, 0),
			projectCssPoint(matrix, width, height),
			projectCssPoint(matrix, 0, height)
		];

		projected.forEach((point, index) => {
			expect(point.x).toBeCloseTo(corners[index].x, 8);
			expect(point.y).toBeCloseTo(corners[index].y, 8);
		});
	});

	it('keeps affine panel projections free of projective terms', () => {
		const transform = getProjectiveCssMatrix3d(
			[
				{ x: 20, y: 30 },
				{ x: 260, y: 30 },
				{ x: 260, y: 230 },
				{ x: 20, y: 230 }
			],
			240,
			200
		);
		const matrix = parseCssMatrix(transform ?? '');

		expect(matrix[3]).toBe(0);
		expect(matrix[7]).toBe(0);
	});

	it('converts panel pixel height and distance into a matching camera FOV', () => {
		const fov = getPanelLocalCameraFov(200, 1000);
		const visibleHeight = 2 * 1000 * Math.tan(THREE.MathUtils.degToRad(fov * 0.5));

		expect(visibleHeight).toBeCloseTo(200);
	});

	it('keeps the viewport centered for centered cameras', () => {
		const rect = projectViewport(10);

		expect(rect).not.toBeNull();
		expect(rect?.x).toBeCloseTo(0);
		expect(rect?.y).toBeCloseTo(0);
	});

	it('removes the shared panel transform from minimap projection', () => {
		const baseline = projectViewport(10);
		const layer = new THREE.Group();
		layer.position.set(180, -90, 14);
		layer.rotation.set(0.08, -0.12, 0.04);
		layer.scale.setScalar(1.35);
		const transformed = projectViewport(10, layer);

		expect(transformed).not.toBeNull();
		expect(transformed?.x).toBeCloseTo(baseline?.x ?? Number.NaN, 5);
		expect(transformed?.y).toBeCloseTo(baseline?.y ?? Number.NaN, 5);
		expect(transformed?.width).toBeCloseTo(baseline?.width ?? Number.NaN, 5);
		expect(transformed?.height).toBeCloseTo(baseline?.height ?? Number.NaN, 5);
	});

	it('shrinks the represented viewport as the stage camera moves closer', () => {
		const far = projectViewport(10);
		const near = projectViewport(5);

		expect(near).not.toBeNull();
		expect(far).not.toBeNull();
		expect(near?.width ?? 0).toBeLessThan(far?.width ?? 0);
		expect(near?.height ?? 0).toBeLessThan(far?.height ?? 0);
	});

	it('uses the spatialElement plane when camera and view target dolly together', () => {
		const spatialElementPlane = projectTravelingTarget(new THREE.Vector3());
		const travelingViewTargetPlane = projectTravelingTarget(new THREE.Vector3(0, 0, -5));

		expect(spatialElementPlane).not.toBeNull();
		expect(travelingViewTargetPlane).not.toBeNull();
		expect(spatialElementPlane?.width ?? 0).toBeLessThan(travelingViewTargetPlane?.width ?? 0);
		expect(spatialElementPlane?.height ?? 0).toBeLessThan(travelingViewTargetPlane?.height ?? 0);
	});

	it('preserves the stage viewport aspect ratio', () => {
		const rect = projectViewport(10);

		expect(rect).not.toBeNull();
		expect((rect?.width ?? 0) / (rect?.height ?? 1)).toBeCloseTo(16 / 9);
	});

	it('moves the minimap rectangle with the main camera target', () => {
		const centered = projectViewportAtTarget(4, new THREE.Vector3());
		const panned = projectViewportAtTarget(4, new THREE.Vector3(0.6, 0.4, 0));

		expect(panned).not.toBeNull();
		expect(panned?.x ?? 0).toBeGreaterThan(centered?.x ?? 0);
		expect(panned?.y ?? 0).toBeGreaterThan(centered?.y ?? 0);
	});

	it('leaves a panned viewport outside the panel instead of moving it onto the model', () => {
		const rect = projectViewportAtTarget(4, new THREE.Vector3(20, -20, 0));

		expect(rect).not.toBeNull();
		expect(clipMinimapViewportRect(rect!, 240, 240)).toEqual({ left: 240, top: 240, width: 0, height: 0 });
	});

	it('clips a wide view independently on each axis without inventing a vertical crop', () => {
		const rect = projectViewport(14)!;
		expect(rect.width).toBeGreaterThan(240);
		expect(rect.height).toBeGreaterThan(240);
		expect(clipMinimapViewportRect(rect, 240, 240)).toEqual({ left: 0, top: 0, width: 240, height: 240 });
		expect(clipMinimapViewportRect({ x: 0, y: 0, width: 160, height: 320 }, 240, 240))
			.toEqual({ left: 40, top: 0, width: 160, height: 240 });
	});

	it('clips just the overlapping area when a zoomed view crosses the panel edge', () => {
		expect(clipMinimapViewportRect({ x: 110, y: 90, width: 100, height: 100 }, 240, 240))
			.toEqual({ left: 180, top: 0, width: 60, height: 80 });
	});

	it('keeps the footprint stable while orbiting a shared, non-origin model center', () => {
		const center = new THREE.Vector3(1.2, -0.8, 0.4);
		const stageModel = new THREE.Group();
		const layer = new THREE.Group();
		const miniature = new THREE.Group();
		const sourceRoot = new THREE.Group();
		sourceRoot.position.copy(center).negate();
		miniature.add(sourceRoot);
		layer.add(miniature);
		const stageCamera = createCamera(5, 16 / 9);
		const minimapCamera = createCamera(12);
		const rectangles = [0, 0.6, 1.8, 3.4, 5.5].map((angle) => {
			stageCamera.position.setFromSphericalCoords(5, 1 + angle * 0.1, angle).add(center);
			stageCamera.lookAt(center);
			stageCamera.updateMatrixWorld(true);
			miniature.quaternion.copy(stageCamera.quaternion).invert();
			return getMinimapViewportRect(stageCamera, minimapCamera, center, stageModel, sourceRoot, layer, 240, 240)!;
		});
		for (const rect of rectangles) {
			expect(rect.x).toBeCloseTo(0, 7);
			expect(rect.y).toBeCloseTo(0, 7);
			expect(rect.width).toBeCloseTo(rectangles[0].width, 7);
			expect(rect.height).toBeCloseTo(rectangles[0].height, 7);
		}
	});

	it('accepts CSS-like non-negative blur radii', () => {
		expect(getMinimapCssBlurRadius(10)).toBe(10);
		expect(getMinimapCssBlurRadius(-4)).toBe(0);
	});
});
