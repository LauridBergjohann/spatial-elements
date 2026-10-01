import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { resolveSpatialElementGeometry } from './spatialElementGeometry.js';
import { SpatialElementAssetManager } from '../catalog/assets/SpatialElementAssetManager.js';
import { prepareSpatialElementFrame } from '../stage/spatialElementFrame.js';

test('both required geometry URLs are validated at the renderer boundary', () => {
	expect(() => resolveSpatialElementGeometry({ low: '', high: '/high.glb' })).toThrow(
		'geometry.low'
	);
	expect(() => resolveSpatialElementGeometry({ low: '/low.glb', high: '' })).toThrow(
		'geometry.high'
	);
	const pair = resolveSpatialElementGeometry({ low: '/low.glb', high: '/high.glb' });
	expect(pair.low.url).toBe('/low.glb');
	expect(pair.high.url).toBe('/high.glb');
	expect(pair.bounds).toBeUndefined();
});

test('identical Low/High URLs share fetching, decoding and owned resources across roles', async () => {
	const scene = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
	scene.add(mesh);
	const loader = { load: vi.fn(async () => ({ scene })) };
	const assets = new SpatialElementAssetManager({ loader });
	const pair = resolveSpatialElementGeometry({ low: '/same.glb', high: '/same.glb' });
	const low = assets.acquire(pair.low);
	const high = assets.acquire(pair.high);
	const [lowInstance, highInstance] = await Promise.all([
		low.createInstance(),
		high.createInstance()
	]);
	expect(loader.load).toHaveBeenCalledTimes(1);
	expect(low.key).toBe(high.key);
	expect(lowInstance.scene).not.toBe(highInstance.scene);
	expect((lowInstance.scene.children[0] as THREE.Mesh).geometry).toBe(
		(highInstance.scene.children[0] as THREE.Mesh).geometry
	);
	low.release();
	high.release();
	lowInstance.dispose();
	expect(assets.getStats().activeInstances).toBe(1);
	highInstance.dispose();
	assets.dispose();
});

test('mixed URL/resource syntax shares identity and conflicting versions are rejected', () => {
	const resource = { url: '/same.glb', format: 'glb' as const, revision: 'v2' };
	const pair = resolveSpatialElementGeometry({ low: '/same.glb', high: resource });
	expect(pair.low).toBe(pair.high);
	expect(pair.low.revision).toBe('v2');
	expect(() =>
		resolveSpatialElementGeometry({ low: resource, high: { ...resource, revision: 'v3' } })
	).toThrow('matching resource revisions');
});

test('URL-only geometry fits shifted Low bounds without inventing frame metadata', () => {
	const pair = resolveSpatialElementGeometry({ low: '/low.glb', high: '/high.glb' });
	const source = new THREE.Group();
	const mesh = new THREE.Mesh(new THREE.BoxGeometry(20, 10, 5), new THREE.MeshStandardMaterial());
	mesh.position.set(100, 30, -15);
	source.add(mesh);
	const model = new THREE.Group();
	const bounds = prepareSpatialElementFrame(model, source, pair, {});
	expect(bounds.getCenter(new THREE.Vector3()).length()).toBeCloseTo(0);
	expect(bounds.getSize(new THREE.Vector3()).x).toBeCloseTo(3);
	expect(pair.bounds).toBeUndefined();
	mesh.geometry.dispose();
	(mesh.material as THREE.Material).dispose();
});
