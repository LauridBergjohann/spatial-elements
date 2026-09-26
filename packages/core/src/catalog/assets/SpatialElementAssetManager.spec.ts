import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import type { SpatialElementAssetResource } from '../spatialElementAssets.js';
import { PreparationGate } from '../PreparationGate.js';
import {
	SpatialElementAssetManager,
	type LoadedSpatialElementAsset,
	type SpatialElementAssetLoader
} from './SpatialElementAssetManager.js';

const resource: SpatialElementAssetResource = {
	url: '/assets/spatialElement.glb',
	format: 'glb',
	revision: 'v1'
};

it('evicts idle bytes while preserving live instances even above the budget', async () => {
	const loader = {
		load: async () => {
			const scene = new THREE.Group();
			scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
			return { scene };
		}
	};
	const manager = new SpatialElementAssetManager({ loader, maxIdleEntries: 6, maxIdleBytes: 1 });
	const lease = manager.acquire(resource);
	const instance = await lease.createInstance();
	lease.release();
	expect(manager.getStats().estimatedResidentBytes).toBeGreaterThan(1);
	expect(manager.getStats().activeInstances).toBe(1);
	const other = manager.acquire({ ...resource, revision: 'other' });
	await other.ready;
	other.release();
	expect(manager.getStats().cachedResources).toBe(1);
	expect(manager.getStats().estimatedIdleBytes).toBe(0);
	instance.dispose();
	expect(manager.getStats().cachedResources).toBe(0);
	expect(manager.getStats().estimatedResidentBytes).toBe(0);
	manager.dispose();
});

it('does not clone a cached resource during motion or retain a cancelled queued instance', async () => {
	const gate = new PreparationGate();
	const scene = new THREE.Group();
	scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()));
	const manager = new SpatialElementAssetManager({
		preparationGate: gate,
		loader: { load: async () => ({ scene, scenes: [scene], animations: [] }) }
	});
	const controller = new AbortController();
	const lease = manager.acquire(resource, { signal: controller.signal });
	await lease.ready;
	gate.setPaused(true);
	const instance = lease.createInstance();
	const rejected = expect(instance).rejects.toMatchObject({ name: 'AbortError' });
	await Promise.resolve();
	expect(manager.getStats().activeInstances).toBe(0);
	controller.abort();
	await rejected;
	gate.setPaused(false);
	expect(manager.getStats()).toMatchObject({ activeInstances: 0, activeLeases: 0 });
	manager.dispose();
});

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((accept, fail) => {
		resolve = accept;
		reject = fail;
	});
	return { promise, resolve, reject };
}

function createLoader() {
	const requests: Array<ReturnType<typeof deferred<LoadedSpatialElementAsset>> & { signal: AbortSignal }> =
		[];
	const load = vi.fn<SpatialElementAssetLoader['load']>((_resource, { signal }) => {
		const request = { ...deferred<LoadedSpatialElementAsset>(), signal };
		requests.push(request);
		return request.promise;
	});
	const dispose = vi.fn();
	return { requests, load, dispose };
}

function asset() {
	const texture = new THREE.Texture();
	const geometry = new THREE.BoxGeometry();
	const material = new THREE.MeshStandardMaterial({ map: texture });
	const mesh = new THREE.Mesh(geometry, material);
	const scene = new THREE.Group();
	scene.add(mesh, new THREE.Mesh(geometry, material));
	return {
		scene,
		mesh,
		geometry,
		material,
		texture,
		geometryDispose: vi.spyOn(geometry, 'dispose'),
		materialDispose: vi.spyOn(material, 'dispose'),
		textureDispose: vi.spyOn(texture, 'dispose')
	};
}

describe('SpatialElementAssetManager', () => {
	it('deduplicates loads and isolates mutable instance materials without disposing shared resources', async () => {
		const loader = createLoader();
		const manager = new SpatialElementAssetManager({ loader });
		const first = manager.acquire(resource);
		const second = manager.acquire(resource);
		await Promise.resolve();
		const source = asset();
		loader.requests[0].resolve(source);
		const [a, b] = await Promise.all([first.createInstance(), second.createInstance()]);
		const aMesh = a.scene.children[0] as THREE.Mesh;
		const bMesh = b.scene.children[0] as THREE.Mesh;
		expect(loader.load).toHaveBeenCalledOnce();
		expect(aMesh.geometry).toBe(source.geometry);
		expect(aMesh.material).not.toBe(bMesh.material);
		expect((aMesh.material as THREE.MeshStandardMaterial).map).toBe(source.texture);
		expect((a.scene.children[1] as THREE.Mesh).material).toBe(aMesh.material);
		(aMesh.material as THREE.Material).opacity = 0.3;
		expect(source.material.opacity).toBe(1);
		first.release();
		second.release();
		a.dispose();
		b.dispose();
		expect(source.geometryDispose).not.toHaveBeenCalled();
		manager.trim(0);
		expect(source.geometryDispose).toHaveBeenCalledOnce();
		expect(source.materialDispose).toHaveBeenCalledOnce();
		expect(source.textureDispose).toHaveBeenCalledOnce();
		manager.dispose();
	});

	it('cancels one consumer without aborting a shared pending load', async () => {
		const loader = createLoader();
		const manager = new SpatialElementAssetManager({ loader });
		const abort = new AbortController();
		const first = manager.acquire(resource, { signal: abort.signal });
		const second = manager.acquire(resource);
		await Promise.resolve();
		abort.abort();
		await expect(first.ready).rejects.toMatchObject({ name: 'AbortError' });
		expect(loader.requests[0].signal.aborted).toBe(false);
		const source = asset();
		loader.requests[0].resolve(source);
		await expect(second.ready).resolves.toBe(source);
		expect(manager.getStats().activeLeases).toBe(1);
		second.release();
		manager.dispose();
	});

	it('rejects abandoned work immediately and disposes a late unabortable decode', async () => {
		const loader = createLoader();
		const manager = new SpatialElementAssetManager({ loader });
		const lease = manager.acquire(resource);
		await Promise.resolve();
		lease.release();
		lease.release();
		await expect(lease.ready).rejects.toMatchObject({ name: 'AbortError' });
		expect(loader.requests[0].signal.aborted).toBe(true);
		const source = asset();
		loader.requests[0].resolve(source);
		await vi.waitFor(() => expect(source.geometryDispose).toHaveBeenCalledOnce());
		expect(manager.getStats()).toMatchObject({
			cachedResources: 0,
			activeLeases: 0,
			pendingLoads: 0
		});
		manager.dispose();
	});

	it('keeps a newer resource generation when an invalidated load arrives later', async () => {
		const loader = createLoader();
		const manager = new SpatialElementAssetManager({ loader });
		const stale = manager.acquire(resource);
		await Promise.resolve();
		manager.invalidate(resource);
		const current = manager.acquire(resource);
		await Promise.resolve();
		await expect(stale.ready).rejects.toMatchObject({ name: 'AbortError' });
		const fresh = asset();
		loader.requests[1].resolve(fresh);
		await expect(current.ready).resolves.toBe(fresh);
		const old = asset();
		loader.requests[0].resolve(old);
		await vi.waitFor(() => expect(old.geometryDispose).toHaveBeenCalledOnce());
		expect(fresh.geometryDispose).not.toHaveBeenCalled();
		const again = manager.acquire(resource);
		await expect(again.ready).resolves.toBe(fresh);
		expect(loader.load).toHaveBeenCalledTimes(2);
		current.release();
		again.release();
		manager.dispose();
	});

	it('lets instances outlive leases and runtime closure without freeing their shared geometry', async () => {
		const source = asset();
		const manager = new SpatialElementAssetManager({ loader: { load: async () => source } });
		const lease = manager.acquire(resource);
		const instance = await lease.createInstance();
		const materialDispose = vi.spyOn(
			(instance.scene.children[0] as THREE.Mesh).material as THREE.Material,
			'dispose'
		);
		lease.release();
		manager.dispose();
		expect(source.geometryDispose).not.toHaveBeenCalled();
		expect(manager.getStats().activeInstances).toBe(1);
		instance.dispose();
		instance.dispose();
		expect(materialDispose).toHaveBeenCalledOnce();
		expect(source.geometryDispose).toHaveBeenCalledOnce();
		expect(manager.getStats().activeInstances).toBe(0);
		await expect(lease.createInstance()).rejects.toMatchObject({ name: 'AbortError' });
	});

	it('bounds the idle cache while preserving active resources and reusing recent entries', async () => {
		const sources = [asset(), asset(), asset()];
		const load = vi
			.fn<SpatialElementAssetLoader['load']>()
			.mockResolvedValueOnce(sources[0])
			.mockResolvedValueOnce(sources[1])
			.mockResolvedValueOnce(sources[2]);
		const manager = new SpatialElementAssetManager({ loader: { load }, maxIdleEntries: 1 });
		const active = manager.acquire(resource);
		await active.ready;
		const otherResource = { ...resource, url: '/assets/other.glb' };
		const other = manager.acquire(otherResource);
		await other.ready;
		other.release();
		const third = manager.acquire({ ...resource, url: '/assets/third.glb' });
		await third.ready;
		third.release();
		expect(sources[0].geometryDispose).not.toHaveBeenCalled();
		expect(sources[1].geometryDispose).toHaveBeenCalledOnce();
		expect(sources[2].geometryDispose).not.toHaveBeenCalled();
		expect(manager.getStats().idleResources).toBe(1);
		active.release();
		manager.dispose();
	});

	it('does not retain failed leases or poison a retry', async () => {
		const source = asset();
		const load = vi
			.fn<SpatialElementAssetLoader['load']>()
			.mockRejectedValueOnce(new Error('network'))
			.mockResolvedValueOnce(source);
		const manager = new SpatialElementAssetManager({ loader: { load } });
		const failed = manager.acquire(resource);
		await expect(failed.ready).rejects.toThrow('network');
		expect(manager.getStats().activeLeases).toBe(0);
		const retry = manager.acquire(resource);
		await expect(retry.ready).resolves.toBe(source);
		expect(load).toHaveBeenCalledTimes(2);
		retry.release();
		manager.dispose();
	});

	it('closes pending consumer promises before deferring decoder disposal until pending work settles', async () => {
		const loader = createLoader();
		const manager = new SpatialElementAssetManager({ loader });
		const lease = manager.acquire(resource);
		await Promise.resolve();
		manager.dispose();
		manager.dispose();
		await expect(lease.ready).rejects.toMatchObject({ name: 'AbortError' });
		expect(loader.dispose).not.toHaveBeenCalled();
		const source = asset();
		loader.requests[0].resolve(source);
		await vi.waitFor(() => expect(loader.dispose).toHaveBeenCalledOnce());
		expect(source.geometryDispose).toHaveBeenCalledOnce();
		expect(() => manager.acquire(resource)).toThrow('disposed');
	});

	it('never requests high implicitly and keeps resource revisions independent', async () => {
		const load = vi.fn<SpatialElementAssetLoader['load']>().mockImplementation(async () => asset());
		const manager = new SpatialElementAssetManager({ loader: { load } });
		const low = manager.acquire(resource);
		await low.ready;
		expect(load).toHaveBeenCalledOnce();
		const high = manager.acquire({ ...resource, url: '/assets/high.glb', revision: 'v2' });
		await high.ready;
		expect(low.key).not.toBe(high.key);
		low.release();
		high.release();
		manager.dispose();
	});
});
