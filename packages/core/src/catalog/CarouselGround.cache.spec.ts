import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CarouselGround, MAX_GROUND_CACHE_ENTRIES } from './CarouselGround.js';

const calls = vi.hoisted(() => ({ prepare: vi.fn(), resolved: vi.fn(), live: vi.fn() }));
vi.mock('./CatalogDepthBlur.js', async importOriginal => {
	const actual = await importOriginal<typeof import('./CatalogDepthBlur.js')>();
	return { ...actual, CatalogDepthBlur: class {
		getRenderTargets() { return []; }
		prepareResolved(renderer: THREE.WebGPURenderer, camera: THREE.PerspectiveCamera,
			rect: unknown, radius: number, target: THREE.RenderTarget, draw: (camera: THREE.PerspectiveCamera) => void) {
			calls.prepare(target, rect, radius); draw(camera);
		}
		drawResolved(_renderer: unknown, texture: THREE.Texture, rect: unknown, opacity: number) {
			calls.resolved(texture, rect, opacity); return true;
		}
		render(_renderer: unknown, camera: THREE.PerspectiveCamera, bounds: unknown, radius: number,
			draw: (camera: THREE.PerspectiveCamera) => void) { calls.live(bounds, radius); draw(camera); }
		dispose() {}
	} };
});
beforeEach(() => {
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	Object.values(calls).forEach(mock => mock.mockReset());
});
afterEach(() => vi.unstubAllGlobals());
function fixture(count = 2) {
	const ground = new CarouselGround(), camera = new THREE.PerspectiveCamera(45, 1440 / 900, 1, 4000);
	camera.position.set(0, 250, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
	const models = Array.from({ length: count }, (_, index) => {
		const model = new THREE.Group(), geometry = new THREE.BoxGeometry(70, 100, 80);
		model.add(new THREE.Mesh(geometry)); model.position.set(index * 12, 50, 0); model.updateMatrixWorld(true);
		return { key: {}, model, geometry, opacity: (index + 1) / 20 };
	});
	function update() {
		ground.beginFrame();
		models.forEach(({ key, model, opacity }) => ground.shadow(key, model, new THREE.Matrix4(), opacity));
		ground.endFrame();
	}
	update();
	const renderer = { render: vi.fn() } as unknown as THREE.WebGPURenderer;
	return { ground, camera, models, renderer, update, dispose() {
		ground.dispose(); models.forEach(({ geometry }) => geometry.dispose());
	} };
}

test('separate normalized shadows retain order and opacity; moving never prepares or allocates a missing cache', () => {
	const f = fixture();
	f.ground.draw(f.renderer, f.camera, 0.5, true, 'full');
	expect(calls.live).toHaveBeenCalledTimes(2); expect(calls.prepare).not.toHaveBeenCalled();
	expect(f.ground.getRenderTargets()).toHaveLength(0);
	f.ground.prepareCaches(f.renderer, f.camera, 'full');
	expect(calls.prepare).toHaveBeenCalledTimes(2);
	const textures = f.ground.getRenderTargets().map(target => target.texture);
	expect(f.ground.getRenderTargets().every(target => target.width === 256 && target.height === 256 && !target.depthBuffer && target.samples === 0)).toBe(true);
	for (const opacity of [1, 0.75, 0.5, 0.2]) {
		f.ground.draw(f.renderer, f.camera, opacity, true, 'full');
		expect(calls.resolved.mock.calls.slice(-2).map(call => call[0])).toEqual(textures);
		expect(calls.resolved.mock.calls.slice(-2).map(call => call[2])).toEqual(f.models.map(model => model.opacity * opacity));
	}
	expect(calls.live).toHaveBeenCalledTimes(2); expect(calls.prepare).toHaveBeenCalledTimes(2);
	f.ground.draw(f.renderer, f.camera, 0, true, 'full');
	expect(calls.resolved).toHaveBeenCalledTimes(8);
	f.ground.prepareCaches(f.renderer, f.camera, 'full');
	expect(calls.prepare).toHaveBeenCalledTimes(2);
	f.dispose();
});

test.each(['pose', 'camera', 'projection', 'viewport', 'target', 'geometry', 'visibility', 'drawRange'] as const)(
	'%s mutation immediately falls back to live drawing without cache work', change => {
		const f = fixture(1); f.ground.prepareCaches(f.renderer, f.camera, 'full');
		let key = 'full';
		if (change === 'pose') { f.models[0].model.position.x += 10; f.models[0].model.updateMatrixWorld(true); f.update(); }
		if (change === 'camera') { f.camera.position.x += 10; f.camera.updateMatrixWorld(true); }
		if (change === 'projection') { f.camera.fov += 2; f.camera.updateProjectionMatrix(); }
		if (change === 'viewport') vi.stubGlobal('innerWidth', 1400);
		if (change === 'target') key = 'scroll';
		if (change === 'geometry') f.models[0].geometry.attributes.position.needsUpdate = true;
		if (change === 'visibility') { f.models[0].model.children[0].visible = false; f.update(); }
		if (change === 'drawRange') f.models[0].geometry.setDrawRange(0, 6);
		f.ground.draw(f.renderer, f.camera, 0.5, true, key);
		expect(calls.resolved).not.toHaveBeenCalled();
		if (change !== 'visibility') expect(calls.live).toHaveBeenCalledOnce();
		expect(calls.prepare).toHaveBeenCalledOnce();
		f.dispose();
	});

test('bounded caches reuse targets on pose refresh and release them with the original shadow owner', () => {
	const f = fixture(MAX_GROUND_CACHE_ENTRIES + 2);
	f.ground.prepareCaches(f.renderer, f.camera);
	expect(calls.prepare).toHaveBeenCalledTimes(MAX_GROUND_CACHE_ENTRIES);
	const targets = f.ground.getRenderTargets(), disposed = targets.map(target => vi.spyOn(target, 'dispose'));
	f.ground.draw(f.renderer, f.camera, 0.5, true);
	expect(calls.resolved).toHaveBeenCalledTimes(MAX_GROUND_CACHE_ENTRIES);
	expect(calls.live).toHaveBeenCalledTimes(2);
	f.models[0].model.position.x += 10; f.models[0].model.updateMatrixWorld(true); f.update();
	f.ground.prepareCaches(f.renderer, f.camera);
	expect(f.ground.getRenderTargets()).toEqual(targets);
	expect(calls.prepare).toHaveBeenCalledTimes(MAX_GROUND_CACHE_ENTRIES + 1);
	f.ground.beginFrame(); f.ground.endFrame();
	expect(f.ground.getRenderTargets()).toHaveLength(0);
	disposed.forEach(dispose => expect(dispose).toHaveBeenCalledOnce());
	f.dispose();
});

test('failed capture restores shadow opacity/visibility and keeps live fallback without an idle retry loop', () => {
	const f = fixture(1);
	f.ground.draw(f.renderer, f.camera, 0.4); calls.live.mockClear();
	let shadow!: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>, group!: THREE.Object3D;
	vi.mocked(f.renderer.render).mockImplementation(scene => {
		group = scene.children.find(child => child.visible)!;
		shadow = group.children[0] as typeof shadow;
		expect(shadow.material.opacity).toBe(1); throw Error('cache write');
	});
	f.ground.prepareCaches(f.renderer, f.camera);
	expect(group.visible).toBe(false); expect(shadow.material.opacity).toBeCloseTo(0.02);
	expect(f.ground.needsCachePreparation(f.camera)).toBe(false);
	vi.mocked(f.renderer.render).mockReset();
	f.ground.draw(f.renderer, f.camera, 0.5, true);
	expect(calls.live).toHaveBeenCalledOnce(); expect(calls.resolved).not.toHaveBeenCalled();
	f.models[0].model.position.x += 10; f.models[0].model.updateMatrixWorld(true); f.update();
	expect(f.ground.needsCachePreparation(f.camera)).toBe(true);
	f.ground.prepareCaches(f.renderer, f.camera);
	f.ground.draw(f.renderer, f.camera, 0.5, true);
	expect(calls.resolved).toHaveBeenCalledOnce();
	f.dispose();
});

test.each(['instanced-mesh', 'instanced-geometry'] as const)('%s always retains live shadows without allocating a cache', kind => {
	const ground = new CarouselGround(), camera = new THREE.PerspectiveCamera(45, 1440 / 900, 1, 4000);
	camera.position.set(0, 250, 1000); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
	const original = new THREE.BoxGeometry(70, 100, 80);
	const geometry = kind === 'instanced-geometry' ? new THREE.InstancedBufferGeometry().copy(original) : original;
	const material = new THREE.MeshBasicMaterial();
	const model = kind === 'instanced-mesh' ? new THREE.InstancedMesh(geometry, material, 2) : new THREE.Mesh(geometry, material);
	model.position.y = 50; model.updateMatrixWorld(true);
	ground.shadow({}, model, new THREE.Matrix4(), 0.2);
	const renderer = { render: vi.fn() } as unknown as THREE.WebGPURenderer;
	expect(ground.needsCachePreparation(camera)).toBe(false);
	ground.prepareCaches(renderer, camera);
	expect(calls.prepare).not.toHaveBeenCalled(); expect(ground.getRenderTargets()).toHaveLength(0);
	ground.draw(renderer, camera, 0.5, true);
	expect(calls.live).toHaveBeenCalledOnce(); expect(calls.resolved).not.toHaveBeenCalled();
	ground.dispose(); geometry.dispose(); if (geometry !== original) original.dispose(); material.dispose();
});
