import * as THREE from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { SpatialGeometryCapture } from './SpatialGeometryCapture.js';

function fixture() {
	const model = new THREE.Group(), view = new THREE.Group(), root = new THREE.Group();
	model.position.set(0.5, -0.3, 0.2); model.scale.setScalar(0.8); model.updateMatrix();
	const canonical = model.matrix.clone();
	root.add(view);
	model.matrixAutoUpdate = false; model.matrix.makeTranslation(10, 20, 30);
	const handoffScene = new THREE.Scene(); handoffScene.add(model); model.updateMatrixWorld(true);
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 50; camera.updateMatrixWorld();
	const actor = { key: 'source', model, view, root, slot: { isConnected: true }, referencePoint: new THREE.Vector3() };
	const disposeActor = vi.fn(() => model.removeFromParent());
	const layer = {
		handoff: { actor, sourceEnvironment: null, sourceEnvironmentIntensity: 0.5 },
		handoffPoint: undefined, camera, scene: new THREE.Scene(), handoffScene,
		actors: new Map([[actor.key, actor]]), desired: new Map([[actor.key, {}]]),
		disposed: false, detachedInstances: 0, layoutDirty: false, disposeActor, invalidate: vi.fn()
	};
	const moving = CatalogSpatialElementLayer.prototype.detachHandoff.call(layer as unknown as CatalogSpatialElementLayer)!;
	return { layer, actor, moving, canonical, disposeActor };
}

test('pre-commit capture disposal restores the exact prepared actor and canonical local matrix once', () => {
	const f = fixture();
	expect(f.layer.detachedInstances).toBe(1); expect(f.layer.actors.size).toBe(0);
	const capture = new SpatialGeometryCapture(f.moving.model, f.moving.projection, {
		environment: null, lights: [], release: () => { f.moving.restore(); }
	});
	capture.dispose(); capture.dispose();
	expect(f.actor.model.parent).toBe(f.actor.view); expect(f.actor.root.parent).toBe(f.layer.scene);
	expect(f.actor.model.matrix.equals(f.canonical)).toBe(true);
	expect(f.layer.actors.get('source')).toBe(f.actor); expect(f.layer.detachedInstances).toBe(0);
	expect(f.layer.layoutDirty).toBe(true); expect(f.disposeActor).not.toHaveBeenCalled();
	f.moving.release(); expect(f.disposeActor).not.toHaveBeenCalled();
});

test.each(['unmounted', 'no-longer-desired', 'disposed'] as const)('a %s source is released rather than restored after the route binding changes', reason => {
	const f = fixture();
	if (reason === 'unmounted') f.actor.slot.isConnected = false;
	if (reason === 'no-longer-desired') f.layer.desired.clear();
	if (reason === 'disposed') f.layer.disposed = true;
	expect(f.moving.restore()).toBe(false); f.moving.release();
	expect(f.disposeActor).toHaveBeenCalledTimes(1); expect(f.layer.detachedInstances).toBe(0);
	expect(f.layer.actors.size).toBe(0);
});

test('explicit post-commit release never allows a later restore to resurrect the source actor', () => {
	const f = fixture(); f.moving.release();
	expect(f.moving.restore()).toBe(false); f.moving.release();
	expect(f.disposeActor).toHaveBeenCalledTimes(1); expect(f.layer.detachedInstances).toBe(0);
	expect(f.layer.actors.size).toBe(0);
});
