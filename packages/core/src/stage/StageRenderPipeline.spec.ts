import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { StageRenderPipeline, type StageRenderPorts } from './StageRenderPipeline.js';
import { withRendererState } from './rendererState.js';
import { describeRenderTargets, gaussianTargets } from './renderTargetInventory.js';
import { gaussianBlur } from 'three/addons/tsl/display/GaussianBlurNode.js';
import { texture } from 'three/tsl';
import { DEFAULT_INTERACTION_THEME } from './stageConstants.js';
import { resolveLiquidGlassPanelOptions } from './LiquidGlassPanel.js';
import type { StageMinimapState } from './minimap/MinimapState.js';

test('zoom preparation restores hidden views and ring material, retries failures and keeps captures live', async () => {
	const f = rendererFixture();
	const scene = new THREE.Scene();
	const view = {
		panelIndex: 0,
		layer: new THREE.Group(),
		overlayComposite: new THREE.Mesh(),
		overlayRing: new THREE.Mesh(),
		ringRestMaterial: new THREE.MeshBasicMaterial(),
		ringForegroundMaterial: new THREE.MeshBasicMaterial(),
		screenCamera: new THREE.PerspectiveCamera(),
		overlayCaptureValid: false,
		panelCaptureValid: false
	} as unknown as StageMinimapState;
	view.layer.visible = view.overlayComposite.visible = view.overlayRing.visible = false;
	view.overlayRing.material = view.ringRestMaterial;
	const compile = vi.fn(() => {
		expect(view.layer.visible).toBe(true);
		expect(view.overlayComposite.visible).toBe(true);
		expect(view.overlayComposite.frustumCulled).toBe(false);
		expect(view.overlayRing.frustumCulled).toBe(false);
		expect(f.renderer.getRenderTarget()).toBeNull();
		return Promise.resolve();
	});
	compile.mockRejectedValueOnce(new Error('compile failed'));
	const blur = vi.fn();
	const pipeline = new StageRenderPipeline({
		renderer: { ...f.renderer, compileAsync: compile, backend: {} },
		minimaps: () => new Map([[0, view]]),
		minimapScene: () => scene,
		panelRuntimes: () => [{ surface: 'frosted' }],
		renderMinimapBlur: blur
	} as unknown as StageRenderPorts);
	Object.assign(pipeline, { foregroundCanvasTarget: f.originalCanvas });
	await expect(pipeline.prepareZoomEffects()).rejects.toThrow('compile failed');
	expect(f.renderer.getRenderTarget()).toBe(f.originalTarget);
	expect(view.layer.visible).toBe(false);
	expect(view.overlayComposite.visible).toBe(false);
	expect(view.overlayRing.visible).toBe(false);
	expect(view.overlayComposite.frustumCulled).toBe(true);
	expect(view.overlayRing.frustumCulled).toBe(true);
	expect(view.overlayRing.material).toBe(view.ringRestMaterial);
	await pipeline.prepareZoomEffects();
	await pipeline.prepareZoomEffects();
	expect(blur).toHaveBeenCalledTimes(2);
	expect(compile).toHaveBeenCalledTimes(4);
	expect(view.overlayCaptureValid).toBe(false);
	expect(view.panelCaptureValid).toBe(false);
	expect(f.renderer.render).not.toHaveBeenCalled();
	view.overlayComposite.geometry.dispose();
	view.overlayRing.geometry.dispose();
	view.ringRestMaterial.dispose();
	view.ringForegroundMaterial.dispose();
	f.originalTarget.dispose();
});

test('half-mask probe preserves target identity across viewport resizes and High replacement', () => {
	vi.stubGlobal('window', {
		location: { search: '?stage-test=1&render-measurement=halo-half-mask' }
	});
	const model = new THREE.Group();
	const pipeline = new StageRenderPipeline({
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		isInteractionMesh: () => true
	} as unknown as StageRenderPorts);
	pipeline.resizeOutline(1440, 900);
	pipeline.createModelOutline(model);
	const target = pipeline.getRenderTargets()[0];
	expect([target.width, target.height]).toEqual([720, 450]);
	pipeline.resizeOutline(1000, 700);
	expect(pipeline.getRenderTargets()[0]).toBe(target);
	expect([target.width, target.height]).toEqual([500, 350]);
	const disposed = vi.spyOn(target, 'dispose');
	pipeline.createModelOutline(model);
	expect(disposed).toHaveBeenCalledOnce();
	expect(pipeline.getRenderTargets().map((t) => [t.width, t.height])).toEqual([[500, 350]]);
	pipeline.releaseOutline();
});

test('fused halo renders the live mask without a separate composite submission', () => {
	vi.stubGlobal('window', { location: { search: '?stage-test=1&render-measurement=halo-fused' } });
	const f = rendererFixture();
	const pipeline = new StageRenderPipeline({
		renderer: f.renderer,
		camera: new THREE.PerspectiveCamera(),
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		isInteractionMesh: () => true,
		frame: () => ({ stageViewportVisible: true, modelHover: true })
	} as unknown as StageRenderPorts);
	pipeline.createModelOutline(new THREE.Group());
	const composite = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
	try {
		pipeline.renderModelOutline(null);
		expect(f.renderer.render).toHaveBeenCalledOnce();
		expect(composite).not.toHaveBeenCalled();
		expect(f.renderer.getRenderTarget()).toBe(f.originalTarget);
	} finally {
		composite.mockRestore();
		pipeline.releaseOutline();
		f.originalTarget.dispose();
	}
});

test('High replacement retains the fused display material and frees the previous mask', () => {
	vi.stubGlobal('window', { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 });
	const f = rendererFixture();
	const pipeline = new StageRenderPipeline({
		renderer: f.renderer,
		backgroundCanvasTarget: f.originalCanvas,
		fallbackPanelOptions: () => [],
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		isInteractionMesh: () => true
	} as unknown as StageRenderPorts);
	pipeline.createSceneCapture();
	const display = pipeline.stageDisplayQuad!.material;
	pipeline.resizeOutline(800, 600);
	pipeline.createModelOutline(new THREE.Group());
	const first = pipeline.getRenderTargets()[0];
	const disposed = vi.spyOn(first, 'dispose');
	pipeline.createModelOutline(new THREE.Group());
	expect(disposed).toHaveBeenCalledOnce();
	expect(pipeline.stageDisplayQuad!.material).toBe(display);
	expect([pipeline.getRenderTargets()[0].width, pipeline.getRenderTargets()[0].height]).toEqual([
		800, 600
	]);
	pipeline.dispose();
	f.originalTarget.dispose();
});

test('normal halo retains the separate composite only while a glass surface is visible', () => {
	const f = rendererFixture();
	const group = new THREE.Group();
	const pipeline = new StageRenderPipeline({
		renderer: f.renderer,
		camera: new THREE.PerspectiveCamera(),
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		isInteractionMesh: () => true,
		panelRuntimes: () => [{ surface: 'glass', group }],
		frame: () => ({ stageViewportVisible: true, modelHover: true })
	} as unknown as StageRenderPorts);
	pipeline.createModelOutline(new THREE.Group());
	const composite = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
	try {
		pipeline.renderModelOutline(null);
		expect(composite).toHaveBeenCalledOnce();
		group.visible = false;
		pipeline.renderModelOutline(null);
		expect(composite).toHaveBeenCalledOnce();
		group.visible = true;
		pipeline.renderModelOutline(null);
		expect(composite).toHaveBeenCalledTimes(2);
	} finally {
		composite.mockRestore();
		pipeline.releaseOutline();
		f.originalTarget.dispose();
	}
});

test('frozen backdrop probe seeds each target and reseeds after resize or a failed capture', () => {
	vi.stubGlobal('window', {
		location: { search: '?stage-test=1&render-measurement=frozen-backdrop' }
	});
	const f = rendererFixture();
	const pipeline = new StageRenderPipeline({ renderer: f.renderer } as unknown as StageRenderPorts);
	const target = new THREE.RenderTarget(16, 16);
	const render = vi.fn();
	const targets = {
		panelBlurCaptures: new Map([[5, { target, quad: { render } }]])
	} as unknown as Parameters<StageRenderPipeline['renderPanelBlurCaptures']>[0];
	render.mockImplementationOnce(() => {
		throw new Error('capture failed');
	});
	expect(() => pipeline.renderPanelBlurCaptures(targets, true)).toThrow('capture failed');
	pipeline.renderPanelBlurCaptures(targets, true);
	pipeline.renderPanelBlurCaptures(targets, true);
	expect(render).toHaveBeenCalledTimes(2);
	target.setSize(32, 32);
	pipeline.renderPanelBlurCaptures(targets, true);
	expect(render).toHaveBeenCalledTimes(3);
	target.dispose();
	f.originalTarget.dispose();
});

test('backdrop blur retains its CSS sampling density across DPR and scroll targets', () => {
	vi.stubGlobal('window', { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 });
	const f = rendererFixture();
	const pipeline = new StageRenderPipeline({
		renderer: { ...f.renderer, setPixelRatio: vi.fn(), setSize: vi.fn() },
		backgroundCanvasTarget: f.originalCanvas,
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		fallbackPanelOptions: () => [resolveLiquidGlassPanelOptions({ backdropBlur: 5 })],
		frame: () => ({ outgoingBackground: false })
	} as unknown as StageRenderPorts);
	pipeline.createSceneCapture();
	for (const dpr of [1, 2]) {
		window.devicePixelRatio = dpr;
		pipeline.resizeRenderTargets();
		const intermediates = pipeline
			.getRenderTargets()
			.filter((target) => target.texture.name.startsWith('GaussianBlurNode.'));
		expect(intermediates).toHaveLength(4);
		expect(intermediates.map((target) => [target.width, target.height])).toEqual(
			Array.from({ length: 4 }, () => [400, 300])
		);
	}
	pipeline.dispose();
	f.originalTarget.dispose();
});

test('late High silhouette replacement retains the current viewport without another resize', () => {
	const model = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
	model.add(mesh);
	const pipeline = new StageRenderPipeline({
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		isInteractionMesh: () => true
	} as unknown as StageRenderPorts);
	pipeline.resizeOutline(1440, 900);
	pipeline.createModelOutline(model);
	const first = pipeline.getRenderTargets()[0];
	expect([first.width, first.height]).toEqual([1440, 900]);
	const dispose = vi.spyOn(first, 'dispose');
	pipeline.createModelOutline(model);
	expect(dispose).toHaveBeenCalledOnce();
	expect(pipeline.getRenderTargets().map((t) => [t.width, t.height])).toEqual([[1440, 900]]);
	pipeline.releaseOutline();
	mesh.geometry.dispose();
	mesh.material.dispose();
});

afterEach(() => vi.unstubAllGlobals());
function rendererFixture() {
	const originalCanvas = {} as THREE.CanvasTarget;
	const originalTarget = new THREE.RenderTarget(5, 7);
	let canvas = originalCanvas,
		target: THREE.RenderTarget | null = originalTarget;
	const clear = new THREE.Color('red'),
		viewport = new THREE.Vector4(1, 2, 3, 4),
		scissor = new THREE.Vector4(5, 6, 7, 8);
	let alpha = 0.4,
		scissorTest = true;
	const renderer = {
		getCanvasTarget: () => canvas,
		setCanvasTarget: (value: THREE.CanvasTarget) => {
			canvas = value;
		},
		getRenderTarget: () => target,
		setRenderTarget: (value: THREE.RenderTarget | null) => {
			target = value;
		},
		getClearColor: (value: THREE.Color) => value.copy(clear),
		getClearAlpha: () => alpha,
		setClearColor: (value: THREE.ColorRepresentation, opacity = 1) => {
			clear.set(value);
			alpha = opacity;
		},
		getViewport: (value: THREE.Vector4) => value.copy(viewport),
		setViewport: (value: THREE.Vector4) => viewport.copy(value),
		getScissor: (value: THREE.Vector4) => value.copy(scissor),
		setScissor: (value: THREE.Vector4) => scissor.copy(value),
		getScissorTest: () => scissorTest,
		setScissorTest: (value: boolean) => {
			scissorTest = value;
		},
		clear: vi.fn(),
		clearDepth: vi.fn(),
		render: vi.fn()
	};
	return { renderer, originalCanvas, originalTarget, clear, viewport, scissor };
}

test('a failed pass restores the borrowed canvas, target, clear and clipping state', () => {
	const f = rendererFixture(),
		r = f.renderer;
	expect(() =>
		withRendererState(r, () => {
			r.setCanvasTarget({} as THREE.CanvasTarget);
			r.setRenderTarget(null);
			r.setClearColor('blue', 0);
			r.setViewport(new THREE.Vector4());
			r.setScissor(new THREE.Vector4());
			r.setScissorTest(false);
			throw new Error('GPU pass failed');
		})
	).toThrow('GPU pass failed');
	expect(r.getCanvasTarget()).toBe(f.originalCanvas);
	expect(r.getRenderTarget()).toBe(f.originalTarget);
	expect(f.clear.getHex()).toBe(0xff0000);
	expect(r.getClearAlpha()).toBe(0.4);
	expect(f.viewport.toArray()).toEqual([1, 2, 3, 4]);
	expect(f.scissor.toArray()).toEqual([5, 6, 7, 8]);
	expect(r.getScissorTest()).toBe(true);
	f.originalTarget.dispose();
});

test('failed quality warm-up restores active targets and regular/minimap panel visibility', () => {
	vi.stubGlobal('window', { devicePixelRatio: 1 });
	const f = rendererFixture();
	const panels = [
		{ group: new THREE.Group(), glass: {} },
		{ group: new THREE.Group(), glass: {} }
	];
	const ports = {
		renderer: f.renderer,
		backgroundCanvasTarget: f.originalCanvas,
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		fallbackPanelOptions: () => [],
		panelRuntimes: () => [],
		minimaps: () => new Map(),
		renderStage: () => {
			throw new Error('warm-up failed');
		}
	} as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports);
	pipeline.createSceneCapture();
	const active = pipeline.activeRenderTargets;
	expect(() => pipeline.warmRenderTargetSets()).toThrow('warm-up failed');
	expect(pipeline.activeRenderTargets).toBe(active);
	expect(f.renderer.getRenderTarget()).toBe(f.originalTarget);
	// A minimap panel is hidden during the regular-glass pass. Restore it if that pass fails.
	ports.panelRuntimes = () => panels as never;
	ports.minimaps = () => new Map([[1, { panelIndex: 1, viewportVisible: true } as never]]);
	f.renderer.render.mockImplementation(() => {
		throw new Error('glass failed');
	});
	expect(() => pipeline.renderBackgroundPanels()).toThrow('glass failed');
	expect(panels.map((panel) => panel.group.visible)).toEqual([true, true]);
	const targets = pipeline.getRenderTargets();
	const disposals = targets.map((target) => vi.spyOn(target, 'dispose'));
	pipeline.dispose();
	pipeline.dispose();
	expect(disposals.every((dispose) => dispose.mock.calls.length === 1)).toBe(true);
	f.originalTarget.dispose();
});

test('inventory deduplicates transferred targets and includes Gaussian intermediate targets', () => {
	const target = new THREE.RenderTarget(16, 32, { samples: 4 });
	const effect = gaussianBlur(texture(target.texture));
	const intermediates = gaussianTargets(effect);
	expect(intermediates).toHaveLength(2);
	const inventory = describeRenderTargets({
		presentation: [target],
		capture: [target],
		blur: intermediates
	});
	expect(inventory.liveTargets).toBe(3);
	expect(inventory.targets[0]).toMatchObject({
		owner: 'presentation',
		width: 16,
		height: 32,
		samples: 4
	});
	effect.dispose();
	target.dispose();
});

test('resizing retains target identity and applies the capped DPR to both quality levels', () => {
	vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 3 });
	const f = rendererFixture();
	const renderer = { ...f.renderer, setPixelRatio: vi.fn(), setSize: vi.fn() };
	const pipeline = new StageRenderPipeline({
		renderer,
		backgroundCanvasTarget: f.originalCanvas,
		interactionTheme: () => DEFAULT_INTERACTION_THEME,
		fallbackPanelOptions: () => [],
		frame: () => ({ outgoingBackground: false })
	} as unknown as StageRenderPorts);
	pipeline.createSceneCapture();
	const targets = pipeline.getRenderTargets();
	pipeline.resizeRenderTargets();
	expect(renderer.setPixelRatio).toHaveBeenCalledWith(2);
	expect(targets.map((target) => [target.width, target.height])).toEqual([
		[1600, 1200],
		[1312, 984]
	]);
	window.innerWidth = 1000;
	pipeline.resizeRenderTargets();
	expect(pipeline.getRenderTargets()).toEqual(targets);
	expect(targets.map((target) => target.width)).toEqual([2000, 1640]);
	expect(pipeline.renderTargetSetCreations).toBe(2);
	pipeline.dispose();
	f.originalTarget.dispose();
});
