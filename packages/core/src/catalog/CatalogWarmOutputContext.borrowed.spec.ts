import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { BackgroundLayerOutput, type BackgroundOutputScratch } from '../stage/BackgroundLayerOutput.js';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
	vi.stubGlobal('innerWidth', 800); vi.stubGlobal('innerHeight', 600);
	const canvas = new THREE.CanvasTarget({ width: 800, height: 600, style: {} } as HTMLCanvasElement);
	canvas.setPixelRatio(1.5);
	let selected = canvas, target: THREE.RenderTarget | null = null, output: THREE.RenderTarget | null = null;
	let face = 0, mip = 0, alpha = 0.4, depth = 1, stencil = 0;
	let mrt: THREE.MRTNode | null = null, renderObject: ReturnType<THREE.WebGPURenderer['getRenderObjectFunction']> = null;
	const color = new THREE.Color(0x123456);
	let finish!: () => void;
	const queue = { onSubmittedWorkDone: vi.fn(() => new Promise<void>(resolve => { finish = resolve; })) };
	const renderer = {
		backend: { isWebGPUBackend: true, device: { queue } }, coordinateSystem: THREE.WebGPUCoordinateSystem,
		samples: 4, depth: true, stencil: false, reversedDepthBuffer: false,
		toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2, outputColorSpace: THREE.SRGBColorSpace,
		xr: { enabled: true, isPresenting: false }, autoClear: false, autoClearColor: false, autoClearDepth: true, autoClearStencil: false,
		getOutputBufferType: () => THREE.HalfFloatType,
		getDrawingBufferSize: (out: THREE.Vector2) => selected.getDrawingBufferSize(out), getPixelRatio: () => selected.getPixelRatio(),
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
		getScissor: (out: THREE.Vector4) => selected.getScissor(out),
		setScissor: (x: number | THREE.Vector4, y?: number, width?: number, height?: number) => {
			if (typeof x === 'number') selected.setScissor(x, y!, width!, height!); else selected.setScissor(x);
		},
		getScissorTest: () => selected.getScissorTest(), setScissorTest: (next: boolean) => { selected.setScissorTest(next); },
		getClearColor: (out: THREE.Color) => out.copy(color), getClearAlpha: () => alpha,
		setClearColor: (next: THREE.ColorRepresentation, opacity: number) => { color.set(next); alpha = opacity; },
		getClearDepth: () => depth, setClearDepth: (next: number) => { depth = next; },
		getClearStencil: () => stencil, setClearStencil: (next: number) => { stencil = next; },
		clear: vi.fn(), render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	const publish = vi.spyOn(THREE.RenderPipeline.prototype, 'render').mockImplementation(() => {});
	const owner = BackgroundLayerOutput.create(renderer, canvas)!;
	const handle = owner.captureScratch()!;
	let current = true;
	const context = CatalogWarmOutputContext.createBorrowed(renderer, handle, () => current)!;
	cleanups.push(() => { context.dispose(); owner.dispose(); canvas.dispose(); });
	const state = () => ({ selected, target, output, face, mip, alpha, depth, stencil, mrt, renderObject,
		color: color.getHex(), viewport: selected.getViewport(new THREE.Vector4()).toArray(),
		scissor: selected.getScissor(new THREE.Vector4()).toArray(), test: selected.getScissorTest(),
		auto: [renderer.autoClear, renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil],
		tone: renderer.toneMapping, exposure: renderer.toneMappingExposure, space: renderer.outputColorSpace, xr: renderer.xr.enabled });
	return { renderer, canvas, owner, handle, context, publish, state, queue, finish: () => finish(), expire: () => { current = false; } };
}

function catalog(f: ReturnType<typeof fixture>) {
	const model = new THREE.Group(), view = new THREE.Group(), root = new THREE.Group();
	root.add(view); view.add(model); root.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 10; camera.updateMatrixWorld();
	const scene = new THREE.Scene(); scene.add(root); scene.fog = new THREE.Fog(0xffffff, 1, 100);
	const actor = { key: 'a', spatialElementId: 'a', model, view, root, rendered: true, materials: [], referencePoint: new THREE.Vector3(), card: { hasAttribute: () => false } };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		scene, camera, carouselCamera: camera, handoffScene: new THREE.Scene(), handoffCamera: new THREE.PerspectiveCamera(),
		actors: new Map([['a', actor]]), desired: new Set(['a']), exitOpacity: 1,
		stagedPrepared: new WeakMap(), stagedWarmFailed: new WeakMap(), stagedPreparing: false, stagedReadinessBlocked: false,
		stagedSourceFrozen: false, stagedWarmRevision: 0, stagedWarmups: 0, stagedWarmFailures: 0, groundPoseSettled: false,
		ground: { prepareWindingVariants: vi.fn(), prepareCaches: vi.fn(), needsCachePreparation: vi.fn(() => false), getStats: () => ({}) },
		carouselDeviceCamera: { angles: new THREE.Vector3() }, glass: { getStats: () => ({}) },
		depthBlur: { getStats: () => ({}) }, outline: { getStats: () => ({}) }, invalidate: vi.fn(),
		geometryFade: { render: vi.fn((_renderer, _opacity, draw) => draw()) }
	}) as CatalogSpatialElementLayer;
	vi.spyOn(layer, 'draw').mockImplementation(renderer => renderer.render(scene, camera));
	return { layer, actor };
}

test('borrowed contexts share the sole output allocation and never dispose or resize it', () => {
	const f = fixture(), target = f.owner.getRenderTargets()[0];
	const dispose = vi.spyOn(target, 'dispose'), resize = vi.spyOn(target, 'setSize');
	expect(f.context.target).toBe(target); expect(f.context.isCurrent(f.renderer)).toBe(true);
	expect(f.owner.getRenderTargets()).toEqual([target]); expect(f.publish).not.toHaveBeenCalled();
	const next = CatalogWarmOutputContext.createBorrowed(f.renderer, f.owner.captureScratch()!, () => true)!;
	expect(next.target).toBe(target); expect(next.profileKey).not.toBe(f.context.profileKey);
	f.context.dispose(); f.context.dispose(); next.dispose();
	expect(dispose).not.toHaveBeenCalled(); expect(resize).not.toHaveBeenCalled();
	expect(f.handle.isCurrent()).toBe(true); expect(f.owner.clearTransparent(false)).toBe(true);
	f.owner.dispose(); f.owner.dispose(); expect(dispose).toHaveBeenCalledOnce();
});

test.each(['success', 'throw', 'promise'] as const)('borrowed %s invalidates pixels before drawing and restores exclusive renderer/target state', mode => {
	const f = fixture(), target = f.context.target;
	f.owner.clearTransparent(false);
	target.viewport.set(3, 5, 90, 80); target.scissor.set(7, 9, 10, 11); target.scissorTest = false;
	const before = f.state(), nested = new THREE.RenderTarget(4, 4); cleanups.push(() => nested.dispose());
	const draw = () => f.context.borrow(f.renderer, () => {
		expect(f.renderer.getRenderTarget()).toBe(target); expect(f.owner.getStats().contentsValid).toBe(false);
		expect(target.viewport.toArray()).toEqual([0, 0, 1200, 900]); expect(target.scissor.toArray()).toEqual([0, 0, 0, 0]);
		expect(f.context.usesCanvasOwner(target)).toBe(true); expect(f.context.usesCanvasOwner(nested)).toBe(false);
		expect(() => f.owner.publish()).toThrow('already in use'); expect(() => f.owner.clearTransparent()).toThrow('already in use');
		f.renderer.setRenderTarget(nested); f.renderer.setScissorTest(true); f.renderer.setClearColor(0, 0);
		f.renderer.setViewport(4, 5, 20, 30); f.renderer.autoClear = true; f.renderer.xr.enabled = false;
		if (mode === 'throw') throw Error('warm draw failed');
		if (mode === 'promise') return Promise.resolve();
	});
	if (mode === 'throw') expect(draw).toThrow('warm draw failed');
	else if (mode === 'promise') expect(draw).toThrow('synchronous'); else draw();
	expect(f.state()).toEqual(before); expect(target.viewport.toArray()).toEqual([3, 5, 90, 80]);
	expect(target.scissor.toArray()).toEqual([7, 9, 10, 11]); expect(target.scissorTest).toBe(false);
	expect(f.context.usesCanvasOwner(target)).toBe(false); expect(f.context.isCurrent(f.renderer)).toBe(true);
	expect(f.owner.publish()).toBe(false); expect(f.publish).not.toHaveBeenCalled();
	expect(f.owner.getStats()).toMatchObject({ busy: false, contentsValid: false, borrows: 1 });
});

test.each(['generation', 'target', 'profile', 'owner', 'stale'] as const)('changed borrowed %s invalidates the context without taking storage ownership', reason => {
	const f = fixture(), dispose = vi.spyOn(f.handle.target, 'dispose');
	let generation = f.handle.generation, target = f.handle.target;
	const handle: BackgroundOutputScratch = { get generation() { return generation; }, get target() { return target; },
		isCurrent: f.handle.isCurrent, borrow: f.handle.borrow };
	let current = true;
	const context = CatalogWarmOutputContext.createBorrowed(f.renderer, handle, () => current)!;
	if (reason === 'generation') generation++;
	if (reason === 'target') { target = new THREE.RenderTarget(2, 2); cleanups.push(() => target.dispose()); }
	if (reason === 'profile') f.renderer.toneMappingExposure = 2;
	if (reason === 'owner') current = false;
	if (reason === 'stale') { f.canvas.setSize(900, 600); f.canvas.setSize(800, 600); }
	expect(context.isCurrent(f.renderer)).toBe(false);
	const draw = vi.fn(); expect(() => context.borrow(f.renderer, draw)).toThrow('stale'); expect(draw).not.toHaveBeenCalled();
	context.dispose(); expect(dispose).not.toHaveBeenCalled();
	if (reason === 'profile' || reason === 'stale')
		expect(CatalogWarmOutputContext.createBorrowed(f.renderer, f.handle, () => true)).toBeUndefined();
});

test('a foreign renderer handle never submits a catalog draw and restores the actual owner', () => {
	const original = fixture(), other = fixture(), before = original.state();
	const context = CatalogWarmOutputContext.createBorrowed(other.renderer, original.handle, () => true)!;
	const draw = vi.fn(); expect(() => context.borrow(other.renderer, draw)).toThrow('another renderer');
	expect(draw).not.toHaveBeenCalled(); expect(original.state()).toEqual(before);
	expect(original.owner.getStats()).toMatchObject({ busy: false, contentsValid: false });
	context.dispose(); expect(original.handle.isCurrent()).toBe(true);
});

test('real catalog preparation restores its lease before the fence and records only that explicit profile', async () => {
	const f = fixture(), { layer, actor } = catalog(f), before = f.state();
	vi.mocked(f.renderer.render).mockImplementation(() => {
		expect(f.renderer.getRenderTarget()).toBe(f.context.target); expect(f.context.usesCanvasOwner(f.context.target)).toBe(true);
		expect(f.owner.getStats()).toMatchObject({ busy: true, contentsValid: false });
	});
	const work = layer.prepareStagedNavigation(f.renderer, f.context);
	expect(f.renderer.render).toHaveBeenCalledTimes(2); expect(f.state()).toEqual(before);
	expect(actor.model.parent).toBe(actor.view); expect(f.owner.getStats().busy).toBe(false);
	expect(layer.isStagedDetailReady('a', undefined, f.renderer, f.context)).toBe(false);
	f.finish(); await work;
	expect(layer.isStagedDetailReady('a', undefined, f.renderer, f.context)).toBe(true);
	expect(layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	expect(f.owner.publish()).toBe(false); expect(f.publish).not.toHaveBeenCalled();
	expect(f.owner.clearTransparent(false)).toBe(true);
	expect(layer.isStagedDetailReady('a', undefined, f.renderer, f.context)).toBe(true);
});

test.each(['resize', 'context-dispose', 'owner-dispose', 'fallback', 'profile', 'owner', 'freeze'] as const)(
	'borrowed %s during the actual catalog fence cannot publish readiness or draw late', async cause => {
	const f = fixture(), { layer, actor } = catalog(f);
	const work = layer.prepareStagedNavigation(f.renderer, f.context);
	const draws = vi.mocked(f.renderer.render).mock.calls.length;
	if (cause === 'resize') { f.canvas.setSize(900, 600); expect(f.owner.resize()).toBe(true); f.canvas.setSize(800, 600); expect(f.owner.resize()).toBe(true); }
	if (cause === 'context-dispose') f.context.dispose();
	if (cause === 'owner-dispose') f.owner.dispose();
	if (cause === 'fallback') f.owner.selectFallback();
	if (cause === 'profile') f.renderer.toneMappingExposure = 2;
	if (cause === 'owner') f.expire();
	if (cause === 'freeze') { layer.capture('a'); layer.freezeStagedSource(); }
	const parent = actor.model.parent;
	f.finish(); await work;
	expect(layer.isStagedDetailReady('a', undefined, f.renderer, f.context)).toBe(false);
	expect(f.renderer.render).toHaveBeenCalledTimes(draws); expect(actor.model.parent).toBe(parent);
	expect(f.owner.getStats().busy).toBe(false); expect(f.publish).not.toHaveBeenCalled();
});
