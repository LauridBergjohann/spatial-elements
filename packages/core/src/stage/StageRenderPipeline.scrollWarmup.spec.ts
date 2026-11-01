import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { StageRenderPipeline, type StageRenderPorts } from './StageRenderPipeline.js';
import { LiquidGlassPanel } from './LiquidGlassPanel.js';
import { DEFAULT_INTERACTION_THEME } from './stageConstants.js';
import type { StagePanelRuntime } from './StagePanelRuntime.js';
import type { StageMinimapState } from './minimap/MinimapState.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture() {
	vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 1000, devicePixelRatio: 1 });
	const canvas = { getDrawingBufferSize: (v: THREE.Vector2) => v.set(1440, 1000),
		getViewport: (v: THREE.Vector4) => v.set(0, 0, 1440, 1000), getPixelRatio: () => 1 } as THREE.CanvasTarget,
		borrowedCanvas = {} as THREE.CanvasTarget;
	const borrowedTarget = new THREE.RenderTarget(3, 5);
	let selectedCanvas = borrowedCanvas, selectedTarget: THREE.RenderTarget | null = borrowedTarget;
	let scissorTest = true, alpha = 0.3;
	const scissor = new THREE.Vector4(2, 3, 4, 5), viewport = new THREE.Vector4(6, 7, 8, 9), color = new THREE.Color('red');
	const draws: { target: THREE.RenderTarget | null; masked: boolean; auto: boolean }[] = [];
	const renderer = {
		backend: { isWebGPUBackend: true }, xr: { enabled: false }, autoClear: true,
		autoClearColor: false, autoClearDepth: true, autoClearStencil: false,
		getOutputRenderTarget: () => null,
		getMRT: () => null, getRenderObjectFunction: () => null,
		getCanvasTarget: () => selectedCanvas, setCanvasTarget: (value: THREE.CanvasTarget) => { selectedCanvas = value; },
		getRenderTarget: () => selectedTarget, setRenderTarget: (value: THREE.RenderTarget | null) => { selectedTarget = value; },
		getScissor: (v: THREE.Vector4) => v.copy(scissor), setScissor: (v: THREE.Vector4) => scissor.copy(v),
		getViewport: (v: THREE.Vector4) => v.copy(viewport), setViewport: (v: THREE.Vector4) => viewport.copy(v),
		getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; },
		getClearColor: (v: THREE.Color) => v.copy(color), getClearAlpha: () => alpha,
		setClearColor: (v: THREE.ColorRepresentation, a = 1) => { color.set(v); alpha = a; },
		setPixelRatio: vi.fn(), setSize: vi.fn(),
		clear: vi.fn(() => { expect(selectedTarget).not.toBeNull(); }), clearDepth: vi.fn(),
		render: vi.fn(() => { draws.push({ target: selectedTarget, masked: scissorTest && scissor.z === 0 && scissor.w === 0, auto: renderer.autoClear }); })
	};
	vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => { renderer.render(); });
	const panelScene = new THREE.Scene(), panels: StagePanelRuntime[] = [], views = new Map<number, StageMinimapState>();
	let current = true;
	const sourceDraw = vi.fn(() => { renderer.clear(); renderer.render(); });
	const ports = { renderer, backgroundCanvasTarget: canvas, panelScene, panelCamera: new THREE.PerspectiveCamera(),
		interactionTheme: () => DEFAULT_INTERACTION_THEME, fallbackPanelOptions: () => [{ backdropBlur: 4 }],
		panelRuntimes: () => panels, minimaps: () => views, renderStage: sourceDraw, frame: () => ({ outgoingBackground: false }) } as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports); pipeline.createSceneCapture();
	const glass = new LiquidGlassPanel(pipeline.getPanelBlurTexture({ backdropBlur: 4 }), { backdropBlur: 4 });
	panels.push({ group: glass.group, glass, options: glass.options, surface: 'glass' } as StagePanelRuntime);
	panelScene.add(glass.group);
	const full = pipeline.activeRenderTargets!;
	const view = { panelIndex: 0, viewportVisible: true, screenCamera: new THREE.PerspectiveCamera(),
		stageCaptureTexture: { value: full.sceneCapture.texture }, stageBlurTexture: { value: pipeline.getPanelBlurTexture(glass.options) },
		overlayCaptureDirty: false } as StageMinimapState;
	views.set(0, view);
	const token = () => pipeline.captureDeferredScrollWarmup(() => current)!;
	return { pipeline, ports, renderer, borrowedCanvas, borrowedTarget, full, glass, panels, view, views, draws, sourceDraw, token,
		invalidate() { current = false; }, dispose() { glass.dispose(); pipeline.dispose(); borrowedTarget.dispose(); } };
}

test('warms one inactive set, masks real canvas contexts and restores every borrowed state', () => {
	const f = fixture();
	const token = f.token(); expect(token).toBeDefined();
	expect(f.pipeline.warmInactiveScrollTargetSet(token)).toBe(true);
	expect(f.sourceDraw).toHaveBeenCalledOnce();
	expect(f.draws.filter(draw => draw.target === f.full.sceneCapture)).toHaveLength(0);
	expect(f.draws.filter(draw => draw.target === null).length).toBeGreaterThanOrEqual(2);
	expect(f.draws.filter(draw => draw.target === null).every(draw => draw.masked && !draw.auto)).toBe(true);
	expect(f.renderer.clearDepth).not.toHaveBeenCalled();
	expect(f.pipeline.activeRenderTargets).toBe(f.full);
	expect(f.view.stageCaptureTexture.value).toBe(f.full.sceneCapture.texture);
	expect(f.view.stageBlurTexture.value).toBe(f.pipeline.getPanelBlurTexture(f.glass.options));
	expect(f.view.overlayCaptureDirty).toBe(true);
	expect(f.renderer.getCanvasTarget()).toBe(f.borrowedCanvas);
	expect(f.renderer.getRenderTarget()).toBe(f.borrowedTarget);
	expect(f.renderer.getScissor(new THREE.Vector4()).toArray()).toEqual([2, 3, 4, 5]);
	expect(f.renderer.getViewport(new THREE.Vector4()).toArray()).toEqual([6, 7, 8, 9]);
	expect(f.renderer.getScissorTest()).toBe(true);
	expect([f.renderer.autoClear, f.renderer.autoClearColor, f.renderer.autoClearDepth, f.renderer.autoClearStencil]).toEqual([true, false, true, false]);
	expect(f.pipeline.warmInactiveScrollTargetSet(token)).toBe(false);
	f.dispose();
});

test.each(['owner', 'resize', 'target-size', 'target-replacement', 'settings', 'blur', 'material', 'panel-children',
	'callback', 'scene-callback', 'scene-override', 'runtime-group', 'minimap', 'output', 'dispose'])(
	'rejects %s changes between warm capture/fence/use without drawing', reason => {
		const f = fixture(), token = f.token();
		if (reason === 'owner') f.invalidate();
		if (reason === 'resize') f.pipeline.resizeRenderTargets();
		if (reason === 'target-size') f.full.sceneCapture.setSize(8, 9);
		if (reason === 'target-replacement') { f.pipeline.disposeSceneCapture(); f.pipeline.createSceneCapture(); }
		if (reason === 'settings') f.pipeline.setRenderSettings();
		if (reason === 'blur') f.pipeline.syncPanelBlurCaptures();
		if (reason === 'material') (f.glass.group.children[0] as THREE.Mesh).material = new THREE.MeshBasicMaterial();
		if (reason === 'panel-children') f.glass.group.add(new THREE.Group());
		if (reason === 'callback') f.glass.group.children[0].onBeforeRender = () => {};
		if (reason === 'scene-callback') f.ports.panelScene.onBeforeRender = () => {};
		if (reason === 'scene-override') f.ports.panelScene.overrideMaterial = new THREE.MeshBasicMaterial();
		if (reason === 'runtime-group') f.panels[0].group = new THREE.Group();
		if (reason === 'minimap') f.views.clear();
		if (reason === 'output') f.ports.backgroundCanvasTarget = {} as THREE.CanvasTarget;
		if (reason === 'dispose') f.pipeline.dispose();
		expect(f.pipeline.warmInactiveScrollTargetSet(token)).toBe(false);
		expect(f.sourceDraw).not.toHaveBeenCalled(); expect(f.draws).toHaveLength(0);
		f.dispose();
	});

test.each(['added-node', 'shader-node', 'scene-mesh', 'callback'])('custom %s graphs never certify canvas masking', custom => {
	const f = fixture();
	if (custom === 'added-node') f.glass.group.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicNodeMaterial()));
	if (custom === 'shader-node') {
		const mesh = f.glass.group.children.find(node => node instanceof THREE.Mesh && node.material instanceof THREE.MeshBasicNodeMaterial) as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicNodeMaterial>;
		mesh.material.fragmentNode = {} as never;
	}
	if (custom === 'scene-mesh') f.ports.panelScene.add(new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial()));
	if (custom === 'callback') f.glass.group.onBeforeRender = () => {};
	expect(f.token()).toBeUndefined();
	expect(f.draws).toHaveLength(0);
	f.dispose();
});

test('supported alpha, texture and size setters keep the constructor-owned panel graph eligible', () => {
	const f = fixture();
	f.glass.setVisibilityAlpha(0.4);
	f.glass.setVisualSize(100, 120, 16);
	f.glass.setBackdropTexture(new THREE.Texture());
	expect(f.glass.hasOwnedRenderGraph()).toBe(true);
	expect(f.token()).toBeDefined();
	f.dispose();
});

test.each(['source', 'panel'])('restores active target, flags and panel visibility after %s failure', failure => {
	const f = fixture(), token = f.token();
	if (failure === 'source') f.sourceDraw.mockImplementation(() => { throw new Error('source failed'); });
	else f.renderer.render.mockImplementation(() => { if (!f.renderer.getRenderTarget()) throw new Error('panel failed'); });
	expect(() => f.pipeline.warmInactiveScrollTargetSet(token)).toThrow(`${failure} failed`);
	expect(f.pipeline.activeRenderTargets).toBe(f.full);
	expect(f.renderer.autoClear).toBe(true);
	expect(f.renderer.getRenderTarget()).toBe(f.borrowedTarget);
	expect(f.renderer.getCanvasTarget()).toBe(f.borrowedCanvas);
	expect(f.glass.group.visible).toBe(true);
	expect(f.pipeline.warmInactiveScrollTargetSet(token)).toBe(false);
	f.dispose();
});
