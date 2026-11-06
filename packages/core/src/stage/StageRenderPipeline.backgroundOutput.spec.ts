import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { StageRenderPipeline, type StageRenderPorts } from './StageRenderPipeline.js';
import { DEFAULT_INTERACTION_THEME } from './stageConstants.js';
import { BackgroundLayerOutput } from './BackgroundLayerOutput.js';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture(search = '?stage-test=1&stage-background-output=1') {
	vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600, devicePixelRatio: 1, location: { search } });
	const canvas = new THREE.CanvasTarget({ width: 300, height: 150, style: {} } as HTMLCanvasElement);
	const foreground = new THREE.CanvasTarget({ width: 800, height: 600, style: {} } as HTMLCanvasElement);
	let selected = canvas, target: THREE.RenderTarget | null = null, output: THREE.RenderTarget | null = null;
	let face = 0, mip = 0, alpha = 1, depth = 1, stencil = 0;
	let mrt: THREE.MRTNode | null = null, renderObject: ReturnType<THREE.WebGPURenderer['getRenderObjectFunction']> = null;
	const color = new THREE.Color(0xffffff);
	const events: { kind: string; canvas: THREE.CanvasTarget; target: THREE.RenderTarget | null }[] = [];
	const record = (kind: string) => { events.push({ kind, canvas: selected, target }); };
	const buffers = new Map();
	const renderer = {
		backend: { isWebGPUBackend: true }, coordinateSystem: THREE.WebGPUCoordinateSystem, _frameBufferTargets: buffers,
		samples: 4, depth: true, stencil: false, reversedDepthBuffer: false,
		toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, outputColorSpace: THREE.SRGBColorSpace,
		xr: { enabled: false, isPresenting: false }, autoClear: false, autoClearColor: true, autoClearDepth: true, autoClearStencil: true,
		getOutputBufferType: () => THREE.HalfFloatType,
		getDrawingBufferSize: (out: THREE.Vector2) => selected.getDrawingBufferSize(out), getPixelRatio: () => selected.getPixelRatio(),
		setSize: (width: number, height: number) => selected.setSize(width, height), setPixelRatio: (ratio: number) => selected.setPixelRatio(ratio),
		getCanvasTarget: () => selected, setCanvasTarget: (next: THREE.CanvasTarget) => { selected = next; },
		getRenderTarget: () => target, setRenderTarget: (next: THREE.RenderTarget | null, nextFace = 0, nextMip = 0) => { target = next; face = nextFace; mip = nextMip; },
		getOutputRenderTarget: () => output, setOutputRenderTarget: (next: THREE.RenderTarget | null) => { output = next; },
		getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
		getMRT: () => mrt, setMRT: (next: THREE.MRTNode | null) => { mrt = next; },
		getRenderObjectFunction: () => renderObject, setRenderObjectFunction: (next: typeof renderObject) => { renderObject = next; },
		getViewport: (out: THREE.Vector4) => selected.getViewport(out),
		setViewport: (x: number | THREE.Vector4, y?: number, width?: number, height?: number, minDepth?: number, maxDepth?: number) => {
			if (typeof x === 'number') selected.setViewport(x, y!, width!, height!, minDepth, maxDepth); else selected.setViewport(x);
		},
		getScissor: (out: THREE.Vector4) => selected.getScissor(out), setScissor: (value: THREE.Vector4) => selected.setScissor(value),
		getScissorTest: () => selected.getScissorTest(), setScissorTest: (value: boolean) => selected.setScissorTest(value),
		getClearColor: (out: THREE.Color) => out.copy(color), getClearAlpha: () => alpha,
		setClearColor: (value: THREE.ColorRepresentation, next: number) => { color.set(value); alpha = next; },
		getClearDepth: () => depth, setClearDepth: (value: number) => { depth = value; },
		getClearStencil: () => stencil, setClearStencil: (value: number) => { stencil = value; },
		clear: vi.fn(() => record('clear')), clearDepth: vi.fn(() => record('depth')), render: vi.fn(() => record('scene'))
	} as unknown as THREE.WebGPURenderer;
	vi.spyOn(THREE.RenderPipeline.prototype, 'render').mockImplementation(() => record('publish'));
	vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => record('quad'));
	const frame = { outgoingBackground: false, catalogDockTarget: false, catalogHandoff: false, catalogMotionComplete: false,
		stageViewportVisible: true, modelHover: false, modelInteractionActive: false, catalog: false, pageModelReady: true, backgroundReveal: 1 };
	const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
	const ports = { renderer, backgroundCanvasTarget: canvas, backgroundCanvas: canvas.domElement,
		container: { toggleAttribute: vi.fn() }, scene, backgroundScene: new THREE.Scene(), tintScene: new THREE.Scene(),
		panelScene: new THREE.Scene(), camera, panelCamera: camera, tintCamera: new THREE.OrthographicCamera(),
		interactionTheme: () => DEFAULT_INTERACTION_THEME, fallbackPanelOptions: () => [], panelRuntimes: () => [], minimaps: () => new Map(),
		frame: () => frame, renderStage: () => { renderer.clear(); renderer.render(scene, camera); },
		catalogLayer: () => undefined, isInteractionMesh: () => false } as unknown as StageRenderPorts;
	const pipeline = new StageRenderPipeline(ports);
	Object.assign(pipeline, { foregroundCanvasTarget: foreground });
	vi.spyOn(pipeline, 'renderBackgroundPanels').mockImplementation(() => renderer.render(ports.panelScene, camera));
	vi.spyOn(pipeline, 'renderMinimapScene').mockImplementation(() => record('minimap'));
	vi.spyOn(pipeline, 'renderCarouselRear').mockImplementation(() => {});
	vi.spyOn(pipeline, 'renderForegroundLayer').mockImplementation(() => {});
	cleanups.push(() => { pipeline.dispose(); canvas.dispose(); });
	const init = () => { pipeline.initializeBackgroundOutput(); pipeline.createSceneCapture(); pipeline.resizeRenderTargets(); events.length = 0; };
	return { pipeline, ports, renderer, canvas, foreground, frame, events, buffers, init };
}

test.each(['', '?stage-background-output=1', '?stage-test=1', '?stage-test=0&stage-background-output=1'])(
	'without both exact test flags initialization and ordinary Canvas output remain unchanged (%s)', query => {
	const f = fixture(query);
	f.pipeline.initializeBackgroundOutput(); expect(f.events).toEqual([]); expect(f.pipeline.getRenderTargets()).toEqual([]);
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ requested: false, initialized: false, mode: 'legacy' });
	f.pipeline.renderFrame(true, false);
	expect(f.events).toEqual([{ kind: 'clear', canvas: f.canvas, target: null }]);
});

test('initialization prepares one final output before source drawing, with the real Canvas dimensions', () => {
	const f = fixture(); f.pipeline.initializeBackgroundOutput();
	const targets = f.pipeline.getRenderTargets(); expect(targets).toHaveLength(1);
	expect(targets[0]).toMatchObject({ width: 800, height: 600, samples: 4 });
	expect(f.canvas.getViewport(new THREE.Vector4()).toArray()).toEqual([0, 0, 800, 600]);
	expect(f.events).toEqual([{ kind: 'clear', canvas: f.canvas, target: targets[0] }, { kind: 'publish', canvas: f.canvas, target: null }]);
	f.pipeline.initializeBackgroundOutput(); expect(f.events).toHaveLength(2);
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ mode: 'explicit', publications: 1, targetTextureId: targets[0].texture.uuid });
});

test('content, complete frames and freeze compose only into the one output target before publication', () => {
	const f = fixture(); f.init(); const owner = f.pipeline.getRenderTargets()[0];
	f.pipeline.renderFrame(true, false);
	expect(f.events).toEqual([{ kind: 'clear', canvas: f.canvas, target: owner }, { kind: 'publish', canvas: f.canvas, target: null }]);
	f.events.length = 0; f.pipeline.renderFrame(false, false);
	expect(f.events.filter(event => event.target === owner).map(event => event.kind)).toEqual(['quad', 'scene']);
	expect(f.events.filter(event => event.canvas === f.canvas && !event.target).map(event => event.kind)).toEqual(['publish']);
	f.events.length = 0; expect(f.pipeline.freezeBackground()).toBe(true);
	expect(f.events.filter(event => event.canvas === f.canvas && !event.target).map(event => event.kind)).toEqual(['publish']);
	expect(f.pipeline.getRenderTargets().filter(target => target === owner)).toHaveLength(1);
});

test('reveal warming never publishes Background pixels and uses the original output target', () => {
	const f = fixture(); f.init(); const owner = f.pipeline.getRenderTargets()[0];
	const before = f.pipeline.getBackgroundOutputStats();
	expect(f.pipeline.warmRevealFrame()).toBe(true);
	expect(f.events.filter(event => event.canvas === f.canvas && !event.target)).toEqual([]);
	expect(f.events.filter(event => event.target === owner).map(event => event.kind)).toEqual(['quad', 'scene']);
	expect(f.pipeline.getBackgroundOutputStats().publications).toBe(before.publications);
	expect(f.pipeline.captureDeferredScrollWarmup(() => true)).toBeUndefined();
});

test('outgoing Canvas retains its pixels and dimensions through frames, warmup and viewport resize', () => {
	const f = fixture(); f.init(); const owner = f.pipeline.getRenderTargets()[0], id = owner.texture.uuid;
	f.frame.outgoingBackground = true; window.innerWidth = 1100;
	f.pipeline.resizeRenderTargets();
	f.pipeline.renderFrame(true, false); f.pipeline.renderFrame(false, false); f.pipeline.warmRenderTargetSets();
	expect(f.events.filter(event => event.canvas === f.canvas && !event.target)).toEqual([]);
	expect(f.canvas.getSize(new THREE.Vector2()).toArray()).toEqual([800, 600]);
	expect(owner.width).toBe(800); expect(f.pipeline.ensureCatalogWarmOutputContext()).toBeUndefined();
	f.frame.outgoingBackground = false; f.events.length = 0; f.pipeline.renderFrame(true, false);
	expect(f.canvas.getSize(new THREE.Vector2()).toArray()).toEqual([1100, 600]);
	expect(f.canvas.getViewport(new THREE.Vector4()).toArray()).toEqual([0, 0, 1100, 600]);
	expect(owner.width).toBe(1100); expect(owner.texture.uuid).toBe(id);
	expect(f.events.filter(event => !event.target).map(event => event.kind)).toEqual(['publish']);
});

test('catalog leases are cached, accounted once, invalidated on resize and never created by diagnostics', () => {
	const f = fixture(); f.init();
	expect(f.pipeline.getBackgroundOutputStats().catalogProfile).toBeNull();
	expect(f.pipeline.peekCatalogWarmOutputContext()).toBeUndefined();
	const context = f.pipeline.ensureCatalogWarmOutputContext()!;
	expect(context).toBeDefined(); expect(f.pipeline.ensureCatalogWarmOutputContext()).toBe(context);
	expect(f.pipeline.peekCatalogWarmOutputContext()).toBe(context);
	expect(f.pipeline.getRenderTargets().filter(target => target === context.target)).toHaveLength(1);
	context.borrow(f.renderer, () => { expect(f.renderer.getRenderTarget()).toBe(context.target); });
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ borrows: 1, catalogProfileCurrent: true, implicitBackgroundTarget: false });
	f.buffers.set(f.canvas, {}); expect(f.pipeline.getBackgroundOutputStats().implicitBackgroundTarget).toBe(true);
	window.innerWidth = 1000; f.pipeline.resizeRenderTargets();
	expect(context.isCurrent(f.renderer)).toBe(false); expect(f.pipeline.getBackgroundOutputStats().catalogProfile).toBeNull();
	const next = f.pipeline.ensureCatalogWarmOutputContext()!;
	expect(next).not.toBe(context); expect(next.target).toBe(context.target); expect(next.profileKey).not.toBe(context.profileKey);
});

test.each(['freeze', 'warm'] as const)('held resize catches up before the outer %s state snapshot', first => {
	const f = fixture(); f.init(); const target = f.pipeline.getRenderTargets()[0];
	f.frame.outgoingBackground = true; window.innerWidth = 1100; f.pipeline.resizeRenderTargets();
	f.frame.outgoingBackground = false;
	if (first === 'freeze') f.pipeline.freezeBackground(); else f.pipeline.warmRenderTargetSets();
	expect(f.canvas.getViewport(new THREE.Vector4()).toArray()).toEqual([0, 0, 1100, 600]);
	expect(target.width).toBe(1100);
	f.pipeline.renderFrame(true, false);
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ mode: 'explicit', width: 1100 });
});

test('terminal fallback during held warming never substitutes a masked Canvas draw', () => {
	const f = fixture(); f.init(); f.frame.outgoingBackground = true;
	f.renderer.toneMappingExposure = 2;
	f.pipeline.warmRenderTargetSets();
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ mode: 'fallback', held: true });
	expect(f.events.filter(event => event.canvas === f.canvas && !event.target)).toEqual([]);
});

test.each(['unsupported', 'compose-throw'] as const)('terminal %s fallback releases the lease and owner once, without recreating them', reason => {
	const f = fixture(); f.init(); const context = f.pipeline.ensureCatalogWarmOutputContext()!, ownerTarget = context.target;
	const dispose = vi.spyOn(ownerTarget, 'dispose');
	if (reason === 'unsupported') f.renderer.toneMappingExposure = 2;
	else vi.spyOn(BackgroundLayerOutput.prototype, 'compose').mockImplementationOnce(() => { throw Error('output failed'); });
	// Diagnostic reads must not trigger fallback or release an allocation.
	f.pipeline.getBackgroundOutputStats(); f.pipeline.getRenderTargets(); expect(dispose).not.toHaveBeenCalled();
	f.pipeline.renderFrame(false, false);
	expect(f.pipeline.getBackgroundOutputStats()).toMatchObject({ mode: 'fallback', catalogProfile: null });
	expect(context.isCurrent(f.renderer)).toBe(false); expect(dispose).toHaveBeenCalledOnce();
	expect(f.events.some(event => event.kind === 'quad' && event.target === null)).toBe(true);
	f.pipeline.initializeBackgroundOutput(); expect(f.pipeline.ensureCatalogWarmOutputContext()).toBeUndefined();
	f.pipeline.dispose(); expect(dispose).toHaveBeenCalledOnce();
});
