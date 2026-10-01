import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { PanelPresentationController, type PanelPresentationPorts } from './PanelPresentationController.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';
import type { StageMinimapState } from './minimap/MinimapState.js';

afterEach(() => vi.unstubAllGlobals());

test.each([
	{ viewport: [1280, 800], size: [240, 180], tilt: false },
	{ viewport: [1280, 800], size: [240, 180], tilt: true },
	{ viewport: [900, 700], size: [360, 270], tilt: true }
])('minimap projection matches all GPU corners without DOM layout reads: %j', ({ viewport, size, tilt }) => {
	const [viewportWidth, viewportHeight] = viewport;
	const [width, height] = size;
	vi.stubGlobal('window', { innerWidth: viewportWidth, innerHeight: viewportHeight, location: { search: '' } });
	const presentation = new PanelPresentationController({} as PanelPresentationPorts);
	const element = { style: {} } as HTMLElement;
	for (const property of ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight']) {
		Object.defineProperty(element, property, { get() { throw new Error(`Unexpected layout read: ${property}`); } });
	}
	presentation.updateSurfaceElement(element, {} as StagePanelRuntime, width, height, true);
	expect(element.style).toMatchObject({ left: '0', top: '0', margin: '0', transformOrigin: '0 0' });

	const layer = new THREE.Group();
	layer.position.set(56, 180, 12);
	if (tilt) layer.rotation.set(0.3, -0.2, 0.08);
	layer.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(50, viewportWidth / viewportHeight, 0.1, 2000);
	camera.position.z = 1000;
	camera.updateMatrixWorld(true);
	presentation.renderFlatMinimapSurface(
		element,
		{ layer, screenCamera: camera } as StageMinimapState,
		width,
		height
	);
	const cssMatrix = new THREE.Matrix4().fromArray(
		element.style.transform.slice('matrix3d('.length, -1).split(',').map(Number)
	);
	for (const [x, y] of [[0, 0], [width, 0], [width, height], [0, height]]) {
		const css = new THREE.Vector4(x, y, 0, 1).applyMatrix4(cssMatrix);
		const gpu = new THREE.Vector3(x - width * 0.5, height * 0.5 - y, 0)
			.applyMatrix4(layer.matrixWorld).project(camera);
		expect(css.x / css.w).toBeCloseTo((gpu.x + 1) * viewportWidth * 0.5, 6);
		expect(css.y / css.w).toBeCloseTo((1 - gpu.y) * viewportHeight * 0.5, 6);
	}
});
