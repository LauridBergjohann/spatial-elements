import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { PanelPresentationController, type PanelPresentationPorts } from './PanelPresentationController.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';
import type { StageMinimapState } from './minimap/MinimapState.js';
import { resolveLiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import { getPanelFocusOpacity, getSequencedMinimapFocus, getStageUiFocus } from './stageMath.js';

afterEach(() => vi.unstubAllGlobals());

test.each([[1916, 907], [1280, 800]])('summary and corner control reach their final pose together at panel clearance (%i x %i)', (width, height) => {
	vi.stubGlobal('window', { innerWidth: width, innerHeight: height, location: { search: '' } });
	const camera = new THREE.PerspectiveCamera(); camera.position.z = height / (2 * Math.tan(Math.PI / 10));
	let focus = 0;
	const summaryWidth = Math.min(494, width * 0.3);
	const summaryLeft = width - 40 - summaryWidth;
	const anchorFrame = {} as HTMLElement;
	const summary = {
		group: new THREE.Group(), pointerLift: 0, pointerReactive: false, focusReactive: true,
		options: resolveLiquidGlassPanelOptions({ width: summaryWidth, height: 504,
			position: { x: summaryLeft + summaryWidth / 2 - width / 2, y: height / 2 - 110 - 252 } }),
		domRenderMode: 'native', nativeRestFrames: 0, surface: 'glass', glass: { setVisibilityAlpha: vi.fn() }
	} as unknown as StagePanelRuntime;
	const runtime = {
		group: new THREE.Group(), pointerLift: 0, pointerReactive: false, focusReactive: 'top-right',
		options: resolveLiquidGlassPanelOptions({ width: 40, height: 40,
			position: { x: summaryLeft - 44 - 20 - width / 2, y: height / 2 - 116 - 20 } }),
		domRenderMode: 'native', nativeRestFrames: 0, surface: 'glass',
		glass: { setVisibilityAlpha: vi.fn() }
	} as unknown as StagePanelRuntime;
	const controller = new PanelPresentationController({
		camera, registrations: () => [{ getFocusAnchor: () => anchorFrame }, { frame: anchorFrame }], minimaps: () => new Map(),
		frame: () => ({ pointer: { active: false }, focus, uiFocus: getStageUiFocus(focus), minimapFocus: 0, presentation: { active: false } }),
		visible: () => true, transitionOpacity: () => 1
	} as unknown as PanelPresentationPorts);
	controller.add(runtime);
	controller.add(summary);
	const positions = new Map<number, number[]>();
	for (const step of [...Array.from({ length: 101 }, (_, i) => i), ...Array.from({ length: 101 }, (_, i) => 100 - i)]) {
		focus = step / 100;
		expect(controller.updatePanelPointerInteraction(1 / 60)).toBe(false);
		const x = width / 2 + runtime.group.position.x - 20;
		const y = height / 2 - runtime.group.position.y - 20;
		expect(x).toBeGreaterThanOrEqual(10); expect(x + 40).toBeLessThanOrEqual(width - 10);
		expect(y).toBeGreaterThanOrEqual(10); expect(y + 40).toBeLessThanOrEqual(height - 10);
		const layout = controller.getPanelPointerLayout(summary, 1, width, height, getStageUiFocus(focus));
		const scale = camera.position.z / (camera.position.z - layout.focusOffset.z);
		const left = layout.centerX - summaryWidth * scale / 2;
		const top = layout.centerY - summary.options.height * scale / 2;
		expect(left - (x + 40)).toBeCloseTo(44, 7);
		expect(y - top).toBeCloseTo(6, 7);
		if (getPanelFocusOpacity(getStageUiFocus(focus)) === 0) {
			expect(x + 40).toBe(width - 10); expect(y).toBe(10);
			expect(left).toBeCloseTo(width + 34, 7);
		}
		if (positions.has(step)) expect([x, y]).toEqual(positions.get(step));
		positions.set(step, [x, y]);
		expect(runtime.group.position.z).toBe(0);
		expect(runtime.glass!.setVisibilityAlpha).toHaveBeenLastCalledWith(1);
	}
	// Position and velocity settle continuously at the exact fade endpoint.
	const around = [0.96 - 1e-5, 0.96, 0.96 + 1e-5].map(uiFocus =>
		controller.getPanelPointerLayout(runtime, 0, width, height, uiFocus));
	for (const axis of ['centerX', 'centerY'] as const) {
		expect(Math.abs(around[2][axis] - around[1][axis])).toBeLessThan(0.05);
		expect(Math.abs((around[2][axis] - around[1][axis]) - (around[1][axis] - around[0][axis]))).toBeLessThan(0.0001);
	}
});

test('minimap projected size and position stop changing as soon as the panels are transparent', () => {
	vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900, location: { search: '' } });
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 1400;
	let focus = 0;
	const minimap = { baseWidth: 120, baseHeight: 120, options: { expandedHeight: 244 } } as StageMinimapState;
	const panel = { options: resolveLiquidGlassPanelOptions({ width: 120, height: 120, position: { x: -608, y: 278 } }) } as StagePanelRuntime;
	const controller = new PanelPresentationController({
		camera, minimaps: () => new Map([[0, minimap]]), registrations: () => [], visible: () => true,
		frame: () => ({ minimapFocus: getSequencedMinimapFocus(focus, getStageUiFocus(focus)) })
	} as unknown as PanelPresentationPorts);
	let finalPose: number[] | undefined;
	for (let step = 0; step <= 100; step++) {
		focus = step / 100;
		const layout = controller.getPanelPointerLayout(panel, 0, 1440, 900, getStageUiFocus(focus));
		if (getPanelFocusOpacity(getStageUiFocus(focus)) !== 0) continue;
		const scale = camera.position.z / (camera.position.z - layout.focusOffset.z);
		const pose = [layout.centerX, layout.centerY, layout.visualWidth * scale, layout.visualHeight * scale];
		expect(layout.visualHeight).toBe(244);
		expect(pose[0] - pose[2] / 2).toBeCloseTo(10, 8);
		expect(pose[1] - pose[3] / 2).toBeCloseTo(10, 8);
		finalPose ??= pose;
		expect(pose).toEqual(finalPose);
	}
	expect(finalPose).toBeDefined();
});

test('compact controls lift without tilt or scaling and stay visible during close-up', () => {
	vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800, location: { search: '' }, matchMedia: () => ({ matches: false }) });
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 1000;
	const pointer = { x: 509, y: 410, active: true };
	const runtime = {
		group: new THREE.Group(), pointerLift: 0, pointerReactive: 'lift', focusReactive: false,
		options: resolveLiquidGlassPanelOptions({ width: 40, height: 40, position: { x: 0, y: 0 } }),
		domRenderMode: 'native', nativeRestFrames: 0, surface: 'glass',
		glass: { setVisibilityAlpha: vi.fn() }
	} as unknown as StagePanelRuntime;
	const controller = new PanelPresentationController({
		camera, registrations: () => [], minimaps: () => new Map(),
		frame: () => ({ pointer, uiFocus: 1, minimapFocus: 0, presentation: { active: false } }),
		visible: () => true, transitionOpacity: () => 1
	} as unknown as PanelPresentationPorts);
	controller.add(runtime);
	for (let i = 0; i < 120; i++) controller.updatePanelPointerInteraction(1 / 60);
	expect(runtime.group.position.toArray()).toEqual([0, 2, 0]);
	expect(runtime.group.rotation.x).toBe(0);
	expect(runtime.group.rotation.y).toBe(0);
	expect(runtime.group.scale.toArray()).toEqual([1, 1, 1]);
	expect(runtime.glass!.setVisibilityAlpha).toHaveBeenLastCalledWith(1);
	expect(controller.updatePanelPointerInteraction(1 / 60)).toBe(false);
	pointer.active = false;
	for (let i = 0; i < 120; i++) controller.updatePanelPointerInteraction(1 / 60);
	expect(runtime.group.position.toArray()).toEqual([0, 0, 0]);
});

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
