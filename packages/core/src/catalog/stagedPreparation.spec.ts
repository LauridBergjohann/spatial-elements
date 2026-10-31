import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';

afterEach(() => vi.unstubAllGlobals());
function fixture() {
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	const model = new THREE.Group(), view = new THREE.Group(), root = new THREE.Group();
	root.add(view); view.add(model); root.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 10; camera.updateMatrixWorld();
	const scene = new THREE.Scene(); scene.add(root); scene.fog = new THREE.Fog(0xffffff, 1, 100);
	const handoffScene = new THREE.Scene(), handoffCamera = new THREE.PerspectiveCamera();
	const actor = { key: 'a', spatialElementId: 'a', model, view, root, rendered: true, materials: [], card: { hasAttribute: () => false } };
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype), {
		scene, handoffScene, handoffCamera, camera, carouselCamera: camera, actors: new Map([['a', actor]]), desired: new Set(['a']),
		stagedPrepared: new WeakMap(), stagedWarmFailed: new WeakMap(), stagedPreparing: false,
		stagedSourceFrozen: false, stagedWarmRevision: 0, stagedWarmups: 0, stagedWarmFailures: 0,
		groundPoseSettled: false,
		ground: { prepareWindingVariants: vi.fn(), prepareCaches: vi.fn(), needsCachePreparation: vi.fn(() => false) },
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
	const renderer = {
		coordinateSystem: THREE.WebGPUCoordinateSystem, backend: { device: { queue: { onSubmittedWorkDone: () => complete } } },
		getDrawingBufferSize: (target: THREE.Vector2) => target.set(1440, 900),
		getCanvasTarget: () => ({}), setCanvasTarget: vi.fn(), getRenderTarget: () => null, setRenderTarget: vi.fn(),
		getClearColor: (target: THREE.Color) => target.set(0xffffff), getClearAlpha: () => 1, setClearColor: vi.fn(),
		getViewport: (target: THREE.Vector4) => target.set(0, 0, 1440, 900), setViewport: vi.fn(),
		getScissor: (target: THREE.Vector4) => target.set(0, 0, 1440, 900), getScissorTest: () => false,
		setScissor: vi.fn(), setScissorTest: vi.fn(), render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	return { layer, renderer, actor, scene, handoffScene, handoffCamera, finish, front, rear, state };
}

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
