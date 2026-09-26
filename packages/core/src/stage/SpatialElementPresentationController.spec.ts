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
	return { scene, dispose: vi.fn() } as unknown as SpatialElementAssetInstance;
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
