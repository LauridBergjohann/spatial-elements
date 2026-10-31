import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { createStagedDockGeometry, type StagedDockGeometryInput } from './stagedDockGeometry.js';
import { MinimapController } from '../stage/MinimapController.js';
import { resolveLiquidGlassPanelOptions } from '../stage/LiquidGlassPanel.js';
import { resolveDetailLayout, type ResponsiveLayoutInput } from '../spatial-element/responsiveLayout.js';
import { resolveSpatialElementDockLayout, getDockedMinimapModelScale } from '../spatial-element/spatialElementDock.js';
import { getCameraOrbitQuaternion, getPerspectiveDistance } from '../stage/stageMath.js';
import { getMeshBounds } from '../stage/stageSceneUtils.js';
import { PANEL_CAMERA_FOV } from '../stage/stageConstants.js';
import type { StagePanelRuntime } from '../stage/StagePanelRuntime.js';
import type { StagePanelTarget } from '../stage/stageTypes.js';

afterEach(() => vi.unstubAllGlobals());

const corners = (bounds: THREE.Box3) => [bounds.min.x, bounds.max.x].flatMap(x =>
	[bounds.min.y, bounds.max.y].flatMap(y => [bounds.min.z, bounds.max.z].map(z => new THREE.Vector3(x, y, z))));
function expectMatrix(actual: THREE.Matrix4, expected: THREE.Matrix4) {
	actual.elements.forEach((value, index) => expect(value).toBeCloseTo(expected.elements[index], 10));
}
function baseInput(layout: ResponsiveLayoutInput = { width: 1440, height: 900 }): StagedDockGeometryInput {
	return { layout, viewport: { width: layout.width, height: layout.height },
		lowBounds: new THREE.Box3(new THREE.Vector3(-1.5, -0.9, -0.7), new THREE.Vector3(1.5, 0.9, 0.7)),
		modelMatrix: new THREE.Matrix4(), center: new THREE.Vector3(), camera: {} };
}

test.each([
	[390, 900, 8, -2, 80], [600, 900, 8, -2, 80], [840, 900, 8, 0, 80],
	[1200, 900, 8, 3, 80], [1600, 900, 12, -13, 112],
	[1809, 900, 8, -9.25, 104.5], [2200, 900, 170, -26, 138],
	[2456, 400, 298, -26, 138]
])('canonical Dock endpoint at %ipx × %ipx is independent of destination DOM', (width, height, x, y, size) => {
	const descriptor = createStagedDockGeometry(baseInput({ width, height }))!;
	expect(descriptor.framing.dock.minimap).toEqual({ x, y, width: size, height: size });
	const center = new THREE.Vector3().applyMatrix4(descriptor.model.matrixWorld).project(descriptor.camera);
	expect((center.x + 1) * width / 2).toBeCloseTo(x + size / 2, 10);
	expect((1 - center.y) * height / 2).toBeCloseTo(y + size / 2, 10);
	expect(descriptor.model.children).toHaveLength(0);
	expect(descriptor.camera.near).toBeGreaterThan(0);
	expect(descriptor.camera.far).toBeGreaterThan(descriptor.camera.near);
});

test('split 3XL has no compact Dock; a short 3XL viewport explicitly uses the 2XL flow fallback', () => {
	for (const width of [2300, 2456, 3440]) {
		expect(createStagedDockGeometry(baseInput({ width, height: 900 }))).toBeUndefined();
		expect(createStagedDockGeometry(baseInput({ width, height: 511 }))).toBeDefined();
	}
});

test('invalid or unavailable asset frames decline, while a point bound stays finite', () => {
	const input = baseInput();
	expect(createStagedDockGeometry({ ...input, lowBounds: new THREE.Box3() })).toBeUndefined();
	expect(createStagedDockGeometry({ ...input, center: new THREE.Vector3(NaN, 0, 0) })).toBeUndefined();
	expect(createStagedDockGeometry({ ...input, viewport: { width: 0, height: 900 } })).toBeUndefined();
	expect(createStagedDockGeometry({ ...input, modelMatrix: new THREE.Matrix4().makeScale(0, 0, 0) })).toBeUndefined();
	const point = createStagedDockGeometry({ ...input, lowBounds: new THREE.Box3(new THREE.Vector3(), new THREE.Vector3()) })!;
	expect([...point.model.matrix.elements, ...point.camera.projectionMatrix.elements].every(Number.isFinite)).toBe(true);
});

test('resting Dock ignores detail fit padding, hover and decoration, and does not mutate its source inputs', () => {
	const input = baseInput();
	const bounds = input.lowBounds.clone(), matrix = input.modelMatrix.clone(), center = input.center.clone();
	const plain = createStagedDockGeometry(input)!;
	const decorated = createStagedDockGeometry({ ...input, camera: { fitPadding: 100, fitScale: 3 },
		minimap: { hoverModelScale: 4, expandedHoverModelScale: 5, expandedHeight: 600, overlayColor: 'red', overlayBlur: 40 } })!;
	expectMatrix(plain.model.matrix, decorated.model.matrix);
	expectMatrix(plain.camera.projectionMatrix, decorated.camera.projectionMatrix);
	expect(input.lowBounds.equals(bounds)).toBe(true);
	expect(input.modelMatrix.equals(matrix)).toBe(true);
	expect(input.center.equals(center)).toBe(true);
});

const parityCases: { name: string; layout: ResponsiveLayoutInput; viewport?: { width: number; height: number };
	minimap?: StagedDockGeometryInput['minimap']; coordinateSystem?: StagedDockGeometryInput['coordinateSystem'] }[] = [
	{ name: 'XS neutral', layout: { width: 390, height: 844 } },
	{ name: 'XL inset / authored scale', layout: { width: 1600, height: 900 }, minimap: { inset: 7, modelScale: 1.8 } },
	{ name: 'lower 2XL classic scrollbar / safe area / changed browser chrome',
		layout: { width: 1809, height: 800, scrollbarWidth: 15, safeArea: { top: 24, bottom: 16, left: 3, right: 4 } },
		viewport: { width: 1809, height: 900 }, minimap: { modelScale: 0.8, dockedView: { azimuth: 42, scale: 1.23456 } } },
	{ name: '2XL elevation override / scale cap / WebGL projection', layout: { width: 2200, height: 900 },
		minimap: { inset: 2, modelScale: 3.2, dockedView: { elevation: -14, scale: 8 } }, coordinateSystem: THREE.WebGLCoordinateSystem },
	{ name: 'short 3XL fallback / minimum scales', layout: { width: 2456, height: 480 },
		minimap: { inset: 500, modelScale: -1, dockedView: { azimuth: -52, elevation: 21, scale: -1 } } }
];

test.each(parityCases)('CPU descriptor equals mounted minimap matrices and projected Low corners: $name', item => {
	const input = baseInput(item.layout);
	input.viewport = item.viewport ?? input.viewport;
	input.minimap = item.minimap;
	input.coordinateSystem = item.coordinateSystem;
	input.camera = { azimuth: -28, elevation: 18, fitPadding: 34, fitScale: 1.3 };
	// Authored pose is already in the asset subtree; the canonical root contains normalization.
	const low = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(3, 1.2, 0.6), new THREE.MeshBasicMaterial());
	mesh.rotation.set(0.1, 0.35, -0.2);
	mesh.position.set(0.2, -0.15, 0.08);
	low.add(mesh);
	const excluded = mesh.clone(); excluded.name = 'excluded'; excluded.position.x = 100; low.add(excluded);
	low.position.set(0.13, -0.08, 0.02); low.scale.setScalar(0.7); low.updateMatrixWorld(true);
	input.modelMatrix = low.matrix.clone();
	input.lowBounds = getMeshBounds(low, object => object.name !== 'excluded');
	// The LOD/canonical pivot intentionally differs from the Low AABB center.
	input.center.set(0.11, -0.12, 0.07);
	const descriptor = createStagedDockGeometry(input)!;
	const dock = resolveSpatialElementDockLayout(input.layout)!;
	const presentationScale = Number(getDockedMinimapModelScale(dock.minimap, dock.header,
		item.minimap?.dockedView?.scale ?? 1).toFixed(3));
	const viewport = input.viewport;
	vi.stubGlobal('window', { innerWidth: viewport.width, innerHeight: viewport.height, devicePixelRatio: 1 });
	const panel: StagePanelRuntime = { group: new THREE.Group(),
		options: resolveLiquidGlassPanelOptions({ width: dock.minimap.width, height: dock.minimap.height }),
		domRenderMode: 'native', nativeRestFrames: 0, pointerLift: 0, pointerReactive: false, surface: 'frosted' };
	panel.group.position.set(dock.minimap.left + dock.minimap.width / 2 - viewport.width / 2,
		viewport.height / 2 - dock.minimap.top - dock.minimap.height / 2, 0);
	const panelCamera = new THREE.PerspectiveCamera(PANEL_CAMERA_FOV, viewport.width / viewport.height, 0.1, 5000);
	panelCamera.coordinateSystem = item.coordinateSystem ?? THREE.WebGPUCoordinateSystem;
	panelCamera.position.z = getPerspectiveDistance(viewport.height, PANEL_CAMERA_FOV);
	panelCamera.updateProjectionMatrix(); panelCamera.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera();
	camera.quaternion.copy(getCameraOrbitQuaternion(input.camera.azimuth, input.camera.elevation));
	const restModel = new THREE.Quaternion(); low.getWorldQuaternion(restModel);
	const capture = new THREE.RenderTarget(1, 1);
	const owner = new MinimapController({
		renderer: { coordinateSystem: panelCamera.coordinateSystem } as THREE.WebGPURenderer,
		camera, panelCamera, panelScene: new THREE.Scene(), panel: () => panel,
		target: () => ({ getMinimapDockProgress: () => 1, getMinimapModelScale: () => presentationScale } as StagePanelTarget),
		spatialElement: () => ({ model: low, low, camera: input.camera, restCamera: camera.quaternion,
			restModel, hasControls: false, center: input.center }),
		frame: () => ({ hovering: false, interacting: false, scrolling: false }), environment: () => undefined,
		capture: () => ({ scale: 1, sceneCapture: capture }), blurTexture: () => capture.texture,
		transitionOpacity: () => 1, pixelRatio: () => 1, includeMesh: object => object.name !== 'excluded'
	});
	try {
		owner.createMinimap(0, input.minimap ?? {});
		const view = owner.views.get(0)!;
		owner.updateMinimapDisplayModel(view, dock.minimap.width, dock.minimap.height, 0);
		owner.syncMinimapProjection(view, dock.minimap.width, dock.minimap.height);
		expectMatrix(descriptor.camera.matrixWorld, view.screenCamera.matrixWorld);
		expectMatrix(descriptor.camera.projectionMatrix, view.screenCamera.projectionMatrix);
		expectMatrix(descriptor.model.matrixWorld, view.spatialElementRoot.matrixWorld);
		expect(descriptor.framing.modelRadius).toBeCloseTo(view.modelRadius, 10);
		for (const localPoint of corners(mesh.geometry.boundingBox!)) {
			const staged = localPoint.clone().applyMatrix4(mesh.matrix).applyMatrix4(descriptor.model.matrixWorld).project(descriptor.camera);
			const mountedMesh = view.spatialElementRoot.children[0];
			const mounted = localPoint.clone().applyMatrix4(mountedMesh.matrixWorld).project(view.screenCamera);
			expect(staged.distanceTo(mounted)).toBeLessThan(1e-10);
		}
	} finally {
		owner.dispose(); capture.dispose(); mesh.geometry.dispose(); mesh.material.dispose();
	}
});
