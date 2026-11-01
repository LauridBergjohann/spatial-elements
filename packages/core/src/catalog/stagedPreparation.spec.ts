import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	const model = new THREE.Group(), view = new THREE.Group(), root = new THREE.Group();
	root.add(view); view.add(model); root.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 10; camera.updateMatrixWorld();
	const scene = new THREE.Scene(); scene.add(root); scene.fog = new THREE.Fog(0xffffff, 1, 100);
	const handoffScene = new THREE.Scene(), handoffCamera = new THREE.PerspectiveCamera();
	const actor = { key: 'a', spatialElementId: 'a', model, view, root, rendered: true, materials: [], referencePoint: new THREE.Vector3(), card: { hasAttribute: () => false } };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		scene, handoffScene, handoffCamera, camera, carouselCamera: camera, actors: new Map([['a', actor]]), desired: new Set(['a']),
		stagedPrepared: new WeakMap(), stagedWarmFailed: new WeakMap(), stagedPreparing: false, stagedReadinessBlocked: false,
		stagedSourceFrozen: false, stagedWarmRevision: 0, stagedWarmups: 0, stagedWarmFailures: 0,
		groundPoseSettled: false,
		ground: { prepareWindingVariants: vi.fn(), prepareCaches: vi.fn(), needsCachePreparation: vi.fn(() => false), getStats: () => ({}) },
		carouselDeviceCamera: { angles: new THREE.Vector3() }, glass: { getStats: () => ({}) },
		depthBlur: { getStats: () => ({}) }, outline: { getStats: () => ({}) }, invalidate: vi.fn(),
		geometryFade: { render: vi.fn((_renderer, _opacity, draw) => draw()) }
	}) as CatalogSpatialElementLayer;
	const state = layer as unknown as { exitOpacity: number };
	state.exitOpacity = 1;
	const front = vi.spyOn(layer, 'draw').mockImplementation((renderer, band) => {
		expect(band).toBe('front'); expect(state.exitOpacity).toBe(0.5);
		renderer.render(scene, camera);
	});
	const rear = vi.spyOn(layer, 'renderRear').mockImplementation(renderer => {
		expect(state.exitOpacity).toBe(0.5); renderer.render(scene, camera);
	});
	let finish!: () => void;
	const complete = new Promise<void>(resolve => { finish = resolve; });
	const queue = { onSubmittedWorkDone: vi.fn(() => complete) };
	const canvas = new THREE.CanvasTarget({ width: 1440, height: 900, style: {} } as HTMLCanvasElement);
	let target: THREE.RenderTarget | null = null;
	const renderer = {
		coordinateSystem: THREE.WebGPUCoordinateSystem, backend: { isWebGPUBackend: true, device: { queue } },
		depth: true, stencil: false, samples: 4, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1,
		outputColorSpace: THREE.SRGBColorSpace, xr: { isPresenting: false }, getOutputBufferType: () => THREE.HalfFloatType,
		getMRT: () => null, getOutputRenderTarget: () => null, getRenderObjectFunction: () => null,
		getDrawingBufferSize: (target: THREE.Vector2) => target.set(1440, 900),
		getPixelRatio: () => canvas.getPixelRatio(),
		getCanvasTarget: () => canvas, setCanvasTarget: vi.fn(), getRenderTarget: () => target,
		setRenderTarget: vi.fn((value: THREE.RenderTarget | null) => { target = value; }),
		getClearColor: (target: THREE.Color) => target.set(0xffffff), getClearAlpha: () => 1, setClearColor: vi.fn(),
		getViewport: (target: THREE.Vector4) => target.set(0, 0, 1440, 900), setViewport: vi.fn(),
		getScissor: (target: THREE.Vector4) => target.set(0, 0, 1440, 900), getScissorTest: () => false,
		setScissor: vi.fn(), setScissorTest: vi.fn(), render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	return { layer, renderer, actor, scene, handoffScene, handoffCamera, finish, front, rear, state, queue };
}

async function groundRefresh() {
	const f = fixture(); Object.assign(f.actor, { pose: {} });
	const initial = f.layer.prepareStagedNavigation(f.renderer); f.finish(); await initial;
	let resolve!: () => void, reject!: (error: Error) => void;
	const fence = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
	f.queue.onSubmittedWorkDone.mockReturnValue(fence);
	const ground = (f.layer as unknown as { ground: { prepareCaches: ReturnType<typeof vi.fn>; needsCachePreparation: ReturnType<typeof vi.fn> } }).ground;
	ground.needsCachePreparation.mockReturnValue(true);
	Object.assign(f.layer, { groundPoseSettled: true });
	return { ...f, ground, resolve, reject };
}

test('a prepared actor stays ready during an optional ground-only fence after borrowed state is restored', async () => {
	const f = await groundRefresh();
	f.ground.prepareCaches.mockImplementation(() => {
		expect(f.state.exitOpacity).toBe(0.5);
		expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
		expect(f.layer.getStats(f.renderer).actors[0].stagedReady).toBe(false);
		f.ground.needsCachePreparation.mockReturnValue(false);
	});
	const refresh = f.layer.prepareStagedNavigation(f.renderer);
	expect(f.state.exitOpacity).toBe(1);
	expect(f.actor.model.parent).toBe(f.actor.view);
	expect(f.layer.getStats(f.renderer).stagedPreparation.preparing).toBe(true);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.layer.getStats(f.renderer).actors[0].stagedReady).toBe(true);
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false); // Still serialized until its fence.
	await f.layer.prepareStagedNavigation(f.renderer);
	expect(f.ground.prepareCaches).toHaveBeenCalledOnce();
	f.resolve(); await refresh;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
});

test('an optional fence cannot make a new actor or an invalid source signature ready', async () => {
	const f = await groundRefresh();
	const work = f.layer.prepareStagedNavigation(f.renderer);
	const actor = { ...f.actor, key: 'b', spatialElementId: 'b' };
	const state = f.layer as unknown as { actors: Map<string, typeof actor>; desired: Set<string> };
	state.actors.set('b', actor); state.desired.add('b');
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.layer.isStagedDetailReady('b', undefined, f.renderer)).toBe(false);
	vi.stubGlobal('innerWidth', 1200);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	f.resolve(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	expect(f.layer.isStagedDetailReady('b', undefined, f.renderer)).toBe(false);
});

test.each(['freeze', 'cancel'] as const)('claiming then %s during an optional fence never triggers late drawing or restores stale state', async action => {
	const f = await groundRefresh();
	const refresh = f.layer.prepareStagedNavigation(f.renderer);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.layer.capture('a')).toBe(true);
	f.layer.freezeStagedSource();
	expect(f.actor.model.parent).toBe(f.handoffScene);
	if (action === 'cancel') { f.layer.finishHandoff(); f.layer.finishStagedPanel(); }
	const parent = f.actor.model.parent;
	f.handoffCamera.position.x = 321;
	f.layer.setExitOpacity(0.37);
	const draws = vi.mocked(f.renderer.render).mock.calls.length;
	const targets = vi.mocked(f.renderer.setRenderTarget).mock.calls.length;
	const cachePreparations = f.ground.prepareCaches.mock.calls.length;
	// Reentrant scheduling while the optional fence is pending remains blocked.
	await f.layer.prepareStagedNavigation(f.renderer);
	f.resolve(); await refresh;
	expect(f.actor.model.parent).toBe(parent);
	expect(f.handoffCamera.position.x).toBe(321);
	expect(f.state.exitOpacity).toBe(0.37);
	expect(f.renderer.render).toHaveBeenCalledTimes(draws);
	expect(f.renderer.setRenderTarget).toHaveBeenCalledTimes(targets);
	expect(f.ground.prepareCaches).toHaveBeenCalledTimes(cachePreparations);
	if (action === 'freeze') expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
});

test('a rejected optional fence leaves previously fenced actor readiness and restored state intact', async () => {
	const f = await groundRefresh();
	const refresh = f.layer.prepareStagedNavigation(f.renderer);
	f.reject(Error('optional shadow submission failed'));
	await expect(refresh).rejects.toThrow('optional shadow submission failed');
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.state.exitOpacity).toBe(1);
	expect(f.actor.model.parent).toBe(f.actor.view);
	expect(f.layer.getStats(f.renderer).stagedPreparation.preparing).toBe(false);
});

test('readiness appears only after actual fade/handoff passes and GPU completion; borrowed scene state is restored synchronously', async () => {
	const f = fixture(), fog = f.scene.fog;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	const preparation = f.layer.prepareStagedNavigation(f.renderer);
	expect(f.renderer.render).toHaveBeenCalledTimes(2);
	expect(f.renderer.setScissor).toHaveBeenCalledWith(0, 0, 0, 0);
	expect(f.front).toHaveBeenCalledOnce(); expect(f.rear).not.toHaveBeenCalled();
	expect(f.state.exitOpacity).toBe(1);
	expect(f.actor.model.parent).toBe(f.actor.view); expect(f.scene.fog).toBe(fog);
	expect(f.handoffScene.children).toHaveLength(0);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	// Another live owner can update this camera while the submitted work finishes.
	f.handoffCamera.position.x = 123;
	f.finish(); await preparation;
	expect(f.handoffCamera.position.x).toBe(123);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
});

test('carousel warming uses its real glass/backdrop rear pass as well as the front band before readiness', async () => {
	const f = fixture(); Object.assign(f.actor, { pose: {} });
	const work = f.layer.prepareStagedNavigation(f.renderer);
	expect(f.rear).toHaveBeenCalledOnce(); expect(f.front).toHaveBeenCalledOnce();
	expect(f.renderer.render).toHaveBeenCalledTimes(3);
	const ground = (f.layer as unknown as { ground: { prepareWindingVariants: ReturnType<typeof vi.fn> } }).ground;
	expect(ground.prepareWindingVariants).toHaveBeenCalledWith(f.renderer, expect.any(THREE.PerspectiveCamera));
	expect(f.state.exitOpacity).toBe(1);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	f.finish(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
});

test('failed ground winding preparation cannot publish staged readiness', async () => {
	const f = fixture(); Object.assign(f.actor, { pose: {} });
	Object.assign(f.layer, { ground: { prepareWindingVariants: () => { throw Error('ground pipeline failed'); } } });
	await expect(f.layer.prepareStagedNavigation(f.renderer)).rejects.toThrow('ground pipeline failed');
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	expect(f.state.exitOpacity).toBe(1);
});

test('cache refresh follows settled source poses at idle without changing the freeze path', async () => {
	const f = fixture(); Object.assign(f.actor, { pose: {} });
	const first = f.layer.prepareStagedNavigation(f.renderer); f.finish(); await first;
	const ground = (f.layer as unknown as { ground: { prepareCaches: ReturnType<typeof vi.fn>; needsCachePreparation: ReturnType<typeof vi.fn> } }).ground;
	ground.needsCachePreparation.mockReturnValue(true);
	// Shader readiness can remain true while a moving source has no reusable image.
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
	Object.assign(f.layer, { groundPoseSettled: true });
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(true);
	ground.prepareCaches.mockImplementation(() => ground.needsCachePreparation.mockReturnValue(false));
	await f.layer.prepareStagedNavigation(f.renderer);
	expect(ground.prepareCaches).toHaveBeenCalledOnce();
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
	ground.needsCachePreparation.mockReturnValue(true);
	f.layer.freezeStagedSource();
	await f.layer.prepareStagedNavigation(f.renderer);
	expect(ground.prepareCaches).toHaveBeenCalledOnce();
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
});

test('idle preparation warms both focused output variants and restores the real hover before yielding', async () => {
	const f = fixture();
	Object.assign(f.actor, { pose: {}, hover: 0.12,
		clip: { left: 0, top: 0, width: 1440, height: 900 }, renderRect: { left: 400, top: 200, width: 200, height: 200 } });
	const actor = f.actor as typeof f.actor & { hover: number };
	const outline = { render: vi.fn(() => { expect(actor.hover).toBe(0.5); }) };
	Object.assign(f.layer, { outline, interactionTheme: () => ({}) });
	f.front.mockImplementation(() => { expect(actor.hover).toBe(0.5); });
	const work = f.layer.prepareStagedNavigation(f.renderer);
	expect(outline.render).toHaveBeenCalledOnce();
	expect(f.renderer.setScissor).toHaveBeenLastCalledWith(new THREE.Vector4(0, 0, 1440, 900));
	expect(actor.hover).toBe(0.12);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	f.finish(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
});

test('viewport or environment changes invalidate a previously warmed actor', async () => {
	const f = fixture(); const work = f.layer.prepareStagedNavigation(f.renderer); f.finish(); await work;
	vi.stubGlobal('innerHeight', 700); expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	vi.stubGlobal('innerHeight', 900); expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(true);
	f.scene.environment = new THREE.Texture(); expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	f.scene.environment.dispose();
});

test('a source claimed or resized during pending GPU work never becomes eligible from stale completion', async () => {
	const f = fixture(); const work = f.layer.prepareStagedNavigation(f.renderer);
	f.layer.freezeStagedSource(); f.finish(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
});

test('failed preparation remains an ordinary-navigation fallback instead of retrying each frame', async () => {
	const f = fixture(); vi.mocked(f.renderer.render).mockImplementation(() => { throw Error('device unavailable'); });
	await expect(f.layer.prepareStagedNavigation(f.renderer)).rejects.toThrow('device unavailable');
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	expect(f.layer.needsStagedPreparation(f.renderer)).toBe(false);
	expect(f.actor.model.parent).toBe(f.actor.view);
});

test('optional scratch warm draws never target Canvas and publish only their own current output profile after the fence', async () => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	context.target.viewport.set(2, 3, 100, 90); context.target.scissor.set(4, 5, 30, 20);
	vi.mocked(f.renderer.render).mockImplementation(() => {
		expect(f.renderer.getRenderTarget()).toBe(context.target);
		expect(context.usesCanvasOwner(context.target)).toBe(true);
		expect(context.target.scissorTest).toBe(true);
		expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(false);
	});
	const work = f.layer.prepareStagedNavigation(f.renderer, context);
	expect(f.renderer.render).toHaveBeenCalledTimes(2);
	expect(f.front).toHaveBeenCalledWith(f.renderer, 'front', context);
	expect(f.renderer.getRenderTarget()).toBeNull(); expect(f.actor.model.parent).toBe(f.actor.view);
	expect(context.target.viewport.toArray()).toEqual([2, 3, 100, 90]);
	expect(context.target.scissor.toArray()).toEqual([4, 5, 30, 20]); expect(context.target.scissorTest).toBe(false);
	expect(context.usesCanvasOwner(context.target)).toBe(false);
	f.finish(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(true);
	expect(f.layer.getStats(f.renderer, context).stagedPreparation.readyActors).toBe(1);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer)).toBe(false);
	const another = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, another)).toBe(false);
	another.dispose(); context.dispose();
});

test.each(['resize', 'dispose', 'owner', 'freeze', 'profile'] as const)('scratch %s during a pending fence rejects stale readiness without late draws', async cause => {
	const f = fixture(); let current = true;
	const context = CatalogWarmOutputContext.create(f.renderer, () => current)!;
	const work = f.layer.prepareStagedNavigation(f.renderer, context);
	const draws = vi.mocked(f.renderer.render).mock.calls.length;
	if (cause === 'resize') { f.renderer.getCanvasTarget().setSize(1200, 900); f.renderer.getCanvasTarget().setSize(1440, 900); }
	if (cause === 'dispose') context.dispose();
	if (cause === 'owner') current = false;
	if (cause === 'freeze') { f.layer.capture('a'); f.layer.freezeStagedSource(); }
	if (cause === 'profile') f.renderer.toneMappingExposure = 2;
	const parent = f.actor.model.parent;
	f.finish(); await work;
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(false);
	expect(f.renderer.render).toHaveBeenCalledTimes(draws); expect(f.actor.model.parent).toBe(parent);
	expect(f.layer.getStats(f.renderer, context).stagedPreparation.preparing).toBe(false);
	context.dispose();
});

test('scratch ground-only refresh preserves existing readiness after restore and the live ground pixel key', async () => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	Object.assign(f.actor, { pose: {} }); Object.assign(f.layer, { groundPoseSettled: true });
	const ground = (f.layer as unknown as { ground: { prepareCaches: ReturnType<typeof vi.fn>; needsCachePreparation: ReturnType<typeof vi.fn> } }).ground;
	const first = f.layer.prepareStagedNavigation(f.renderer, context); f.finish(); await first;
	const pixelKey = ground.prepareCaches.mock.calls[0][2]; expect(pixelKey).not.toContain(context.profileKey);
	let finish!: () => void;
	f.queue.onSubmittedWorkDone.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
	ground.needsCachePreparation.mockReturnValue(true);
	ground.prepareCaches.mockImplementation(() => {
		expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(false);
		ground.needsCachePreparation.mockReturnValue(false);
	});
	const refresh = f.layer.prepareStagedNavigation(f.renderer, context);
	expect(ground.prepareCaches.mock.calls.at(-1)![2]).toBe(pixelKey);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(true);
	expect(f.layer.needsStagedPreparation(f.renderer, context)).toBe(false);
	finish(); await refresh; context.dispose();
});

test('a scratch submission failure restores source and target state and does not retry the failed profile', async () => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	context.target.viewport.set(2, 3, 100, 90); context.target.scissor.set(4, 5, 30, 20);
	vi.mocked(f.renderer.render).mockImplementation(() => { throw Error('scratch draw failed'); });
	await expect(f.layer.prepareStagedNavigation(f.renderer, context)).rejects.toThrow('scratch draw failed');
	expect(f.renderer.getRenderTarget()).toBeNull(); expect(f.actor.model.parent).toBe(f.actor.view);
	expect(f.state.exitOpacity).toBe(1); expect(context.usesCanvasOwner(context.target)).toBe(false);
	expect(context.target.viewport.toArray()).toEqual([2, 3, 100, 90]);
	expect(context.target.scissor.toArray()).toEqual([4, 5, 30, 20]);
	expect(f.layer.isStagedDetailReady('a', undefined, f.renderer, context)).toBe(false);
	expect(f.layer.needsStagedPreparation(f.renderer, context)).toBe(false);
	expect(f.queue.onSubmittedWorkDone).not.toHaveBeenCalled(); context.dispose();
});
