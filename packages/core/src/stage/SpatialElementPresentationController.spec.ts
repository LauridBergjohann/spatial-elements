import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import type {
	SpatialElementAssetInstance,
	SpatialElementAssetManager
} from '../catalog/assets/SpatialElementAssetManager.js';
import { SpatialElementPresentationController } from './SpatialElementPresentationController.js';
import { resolveStageProfile } from './resolveStageProfile.js';
import { SpatialElementRefinement } from './SpatialElementRefinement.js';

function instance() {
	const scene = new THREE.Group();
	scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
	return { scene, animations: [], dispose: vi.fn() } as unknown as SpatialElementAssetInstance;
}
function fixture() {
	const pending: ((value: SpatialElementAssetInstance) => void)[] = [];
	const release = vi.fn();
	const assets = {
		acquire: vi.fn(() => ({
			createInstance: () => new Promise<SpatialElementAssetInstance>((resolve) => pending.push(resolve)),
			release
		}))
	} as unknown as Pick<SpatialElementAssetManager, 'acquire'>;
	return { owner: new SpatialElementPresentationController(assets, vi.fn()), pending, release };
}

test('page cancellation disposes a late Low instance without adopting it', async () => {
	const { owner, pending, release } = fixture();
	const load = owner.load(resolveStageProfile({ glb: '/a.glb' }));
	owner.cancelRequests();
	const late = instance();
	pending[0](late);
	await load;
	expect(owner.model).toBeUndefined();
	expect(late.dispose).toHaveBeenCalledTimes(1);
	expect(release).toHaveBeenCalledTimes(1);
});

test('a retained hero survives page release and is disposed by its capture owner', async () => {
	const { owner, pending } = fixture();
	const low = instance();
	const load = owner.load(resolveStageProfile({ glb: '/a.glb' }));
	pending[0](low);
	await load;
	const transfer = owner.takeHero()!;
	owner.release();
	expect(low.dispose).not.toHaveBeenCalled();
	expect(transfer.model.children).toHaveLength(1);
	owner.disposeTransfer(transfer);
	owner.disposeTransfer(transfer);
	expect(low.dispose).toHaveBeenCalledTimes(1);
});

test('capture cancellation restores Low and its independent minimap source', async () => {
	const { owner, pending } = fixture();
	const load = owner.load(resolveStageProfile({ glb: '/a.glb' }));
	pending[0](instance());
	await load;
	const model = owner.model;
	const low = owner.lowModel;
	const transfer = owner.takeHero()!;
	owner.restoreHero(transfer);
	owner.disposeTransfer(transfer);
	expect(owner.model).toBe(model);
	expect(owner.lowModel).toBe(low);
	expect(owner.modelKey).toBe(resolveStageProfile({ glb: '/a.glb' }).modelKey);
	owner.release();
});

test('interrupted prepared High is released exactly once while Low remains usable', async () => {
	const { owner, pending } = fixture();
	const load = owner.load(resolveStageProfile({ glb: '/a.glb' }));
	const low = instance();
	pending[0](low);
	await load;
	const high = instance();
	owner.adoptHigh(
		{ instance: high, pose: high.scene, overrides: new Set(), blend: new SpatialElementRefinement(true) },
		false
	);
	owner.cancelHigh();
	owner.cancelHigh();
	expect(high.dispose).toHaveBeenCalledTimes(1);
	expect(low.dispose).not.toHaveBeenCalled();
	expect(owner.model?.children.every((child) => child.visible)).toBe(true);
	expect(owner.lowModel).toBeDefined();
	owner.release();
	expect(low.dispose).toHaveBeenCalledTimes(1);
});

async function endpointFixture() {
	const f = fixture(), low = instance(), high = instance();
	const load = f.owner.load(resolveStageProfile({ glb: '/a.glb' })); f.pending[0](low); await load;
	f.owner.adoptHigh({ instance: high, pose: high.scene, overrides: new Set(), blend: new SpatialElementRefinement(true) }, false);
	const scene = new THREE.Scene(); scene.add(f.owner.model!); scene.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(); camera.updateMatrixWorld(true);
	const destination = new THREE.RenderTarget(40, 30, { type: THREE.HalfFloatType, samples: 4 });
	let target: THREE.RenderTarget | null = destination;
	const renderer = { getRenderTarget: () => target, setRenderTarget: (next: THREE.RenderTarget | null) => { target = next; },
		getScissorTest: () => false, setScissorTest: vi.fn(), clear: vi.fn(), render: vi.fn() } as unknown as THREE.WebGPURenderer;
	return { ...f, low, high, scene, camera, renderer };
}

test('hidden warm-up keeps the representation/clock intact; cache completion retains the existing full High final draw', async () => {
	const f = await endpointFixture(), draw = vi.fn(), changed = vi.fn();
	const visibility = f.owner.model!.children.map(child => child.visible);
	expect(f.owner.renderRefinement(f.renderer, f.scene, undefined, draw, changed, true, { advanceClock: false, backgroundReveal: 1 })).toBe(true);
	expect(f.owner.refinementFrames).toBe(0); expect(f.owner.refinementState).toBe('decoded');
	expect(f.owner.model!.children.map(child => child.visible)).toEqual(visibility);
	expect(changed).not.toHaveBeenCalled();
	const ticket = f.owner.prepareSceneEndpoints(f.renderer, f.scene, f.camera, undefined, () => {}, () => true)!;
	expect(ticket).toBeDefined(); expect(ticket.commit()).toBe(true);
	draw.mockClear();
	f.owner.renderRefinement(f.renderer, f.scene, undefined, draw, changed, true, { backgroundReveal: 0.63 });
	expect(draw).toHaveBeenCalledTimes(1); // Existing full-resolution final High draw, not Low+High rerender.
	expect(changed).toHaveBeenCalledTimes(1); expect(f.owner.refinementState).toBe('high');
	expect(f.owner.getRenderTargets()).toHaveLength(2);
	expect(f.owner.getSceneEndpointStats()[0]).toMatchObject({ hits: 1, active: false });
	f.owner.release();
});

test('hero ownership transfer releases endpoint colors while preserving the underlying Low/High owner', async () => {
	const f = await endpointFixture();
	const ticket = f.owner.prepareSceneEndpoints(f.renderer, f.scene, f.camera, undefined, () => {}, () => true)!;
	expect(ticket.commit()).toBe(true); expect(f.owner.getRenderTargets()).toHaveLength(4);
	const transfer = f.owner.takeHero()!;
	expect(ticket.commit()).toBe(false); expect(transfer.refinement!.getRenderTargets()).toHaveLength(2);
	expect(f.low.dispose).not.toHaveBeenCalled(); expect(f.high.dispose).not.toHaveBeenCalled();
	f.owner.restoreHero(transfer); f.owner.release();
	expect(f.low.dispose).toHaveBeenCalledTimes(1); expect(f.high.dispose).toHaveBeenCalledTimes(1);
});

test('asset animation clips reject the cache even when the Object3D graph has no clips', async () => {
	const f = await endpointFixture(); f.high.animations.push(new THREE.AnimationClip('authored', 1, []));
	expect(f.high.scene.animations).toHaveLength(0);
	expect(f.owner.prepareSceneEndpoints(f.renderer, f.scene, f.camera, undefined, () => {}, () => true)).toBeUndefined();
	expect(f.owner.getRenderTargets()).toHaveLength(0);
	f.owner.release();
});

test('finishing handoff releases endpoint colors before switching a still-refining owner', async () => {
	const f = await endpointFixture();
	const old = f.owner.refinement!;
	const ticket = f.owner.prepareSceneEndpoints(f.renderer, f.scene, f.camera, undefined, () => {}, () => true)!;
	expect(ticket.commit()).toBe(true); expect(old.getRenderTargets()).toHaveLength(4);
	f.owner.finishHandoff(true);
	expect(old.getRenderTargets()).toHaveLength(2);
	expect(ticket.commit()).toBe(false);
	expect(f.owner.refinement).not.toBe(old);
	old.dispose(); f.owner.release();
});
