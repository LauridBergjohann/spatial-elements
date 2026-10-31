import * as THREE from 'three/webgpu';
import { expect, test } from 'vitest';
import { createStagedDetailGeometry, detailCameraFit } from './stagedDetailGeometry.js';
import { sourceDomProjectiveMatrix } from './SourceDomMotion.js';
import { resolveDetailLayout } from '../spatial-element/responsiveLayout.js';
import { prepareSpatialElementFrame } from '../stage/spatialElementFrame.js';

test.each([[1200, 400], [1600, 400], [840, 300], [390, 900], [3440, 900]])(
	'pre-route camera matches the mounted detail viewport projection at %ix%i', (width, height) => {
		const viewport = { width, height }, fit = resolveDetailLayout(viewport).mediaFit;
		const bounds = new THREE.Box3(new THREE.Vector3(-1.5, -0.9, -0.7), new THREE.Vector3(1.5, 0.9, 0.7));
		const settings = { azimuth: 23, elevation: 14, fitPadding: 11 };
		const staged = createStagedDetailGeometry(bounds, new THREE.Matrix4(), settings, viewport, fit);
		// Mirrors updateViewportFrame + updateStageCameraProjection: fit size is
		// intrinsic, but the visible clipped viewport owns the camera's center.
		const mounted = new THREE.PerspectiveCamera(45, width / height, 0.01, 100);
		mounted.coordinateSystem = THREE.WebGPUCoordinateSystem;
		const framing = detailCameraFit(bounds, mounted, settings, viewport, {
			width: Math.min(fit.width, width), height: Math.min(fit.height, height)
		});
		mounted.position.copy(framing.center).addScaledVector(framing.direction, framing.distance);
		mounted.near = framing.near; mounted.far = framing.far; mounted.lookAt(framing.center);
		const left = THREE.MathUtils.clamp(fit.x, 0, width), top = THREE.MathUtils.clamp(fit.y, 0, height);
		const right = THREE.MathUtils.clamp(fit.x + fit.width, 0, width), bottom = THREE.MathUtils.clamp(fit.y + fit.height, 0, height);
		const offsetX = width / 2 - (left + Math.max(right - left, 1) / 2);
		const offsetY = height / 2 - (top + Math.max(bottom - top, 1) / 2);
		if (Math.abs(offsetX) > 0.25 || Math.abs(offsetY) > 0.25) mounted.setViewOffset(width, height, offsetX, offsetY, width, height);
		else mounted.updateProjectionMatrix();
		mounted.updateMatrixWorld();
		for (const point of [bounds.min, bounds.max, bounds.getCenter(new THREE.Vector3())]) {
			const actual = point.clone().project(staged.camera), expected = point.clone().project(mounted);
			expect((actual.x - expected.x) * width / 2).toBeCloseTo(0, 7);
			expect((actual.y - expected.y) * height / 2).toBeCloseTo(0, 7);
		}
	}
);

test('canonical imported model frame survives interaction on its ancestors and matches the detail fit model', () => {
	const source = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1), new THREE.MeshBasicMaterial());
	mesh.position.set(2, 3, -1); source.add(mesh);
	const model = new THREE.Group();
	const bounds = prepareSpatialElementFrame(model, source, {
		assetToFrame: new THREE.Matrix4().toArray(), bounds: { min: [0, 2, -1.5], max: [4, 4, -0.5] }
	} as Parameters<typeof prepareSpatialElementFrame>[2], { rotation: { x: 0.3, y: 0.5, z: 0.1 } });
	const canonical = model.matrix.clone();
	const interactive = new THREE.Group(); interactive.position.set(700, 140, 200); interactive.rotation.set(0.2, -0.7, 0.4);
	interactive.scale.setScalar(90); interactive.add(model); interactive.updateMatrixWorld(true);
	const viewport = { width: 1440, height: 900 };
	const staged = createStagedDetailGeometry(bounds, canonical, {}, viewport, resolveDetailLayout(viewport).mediaFit);
	expect(staged.model.matrix.equals(canonical)).toBe(true);
	expect(staged.model.matrix.equals(model.matrixWorld)).toBe(false);
	const transformedCenter = source.getWorldPosition(new THREE.Vector3());
	expect(Number.isFinite(transformedCenter.x)).toBe(true);
	mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose();
});

test('the retained glass screen-to-world matrix projects the same four corners as the moving DOM', () => {
	const width = 480, height = 260, viewport = { width: 1440, height: 900 };
	const quad = [{ x: 770, y: 130 }, { x: 1190, y: 158 }, { x: 1205, y: 450 }, { x: 760, y: 420 }] as const;
	const homography = sourceDomProjectiveMatrix(quad, width, height)!;
	const matrix = new THREE.Matrix4().makeTranslation(-viewport.width / 2, viewport.height / 2, 0)
		.multiply(new THREE.Matrix4().makeScale(1, -1, 1)).multiply(new THREE.Matrix4().fromArray(homography))
		.multiply(new THREE.Matrix4().makeTranslation(width / 2, height / 2, 0))
		.multiply(new THREE.Matrix4().makeScale(1, -1, 1));
	const camera = new THREE.PerspectiveCamera(THREE.MathUtils.radToDeg(2 * Math.atan(viewport.height / 5000)), viewport.width / viewport.height, 1, 4000);
	camera.position.z = 2500; camera.updateMatrixWorld();
	const corners = [[-width / 2, height / 2], [width / 2, height / 2], [width / 2, -height / 2], [-width / 2, -height / 2]];
	for (let index = 0; index < 4; index++) {
		const point = new THREE.Vector3(...corners[index], 0).applyMatrix4(matrix).project(camera);
		expect((point.x + 1) * viewport.width / 2).toBeCloseTo(quad[index].x, 7);
		expect((1 - point.y) * viewport.height / 2).toBeCloseTo(quad[index].y, 7);
	}
});
