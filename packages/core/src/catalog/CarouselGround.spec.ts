import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CarouselGround, carouselShadowProjection } from './CarouselGround.js';

vi.mock('./CatalogDepthBlur.js', () => ({ CatalogDepthBlur: class {
	getRenderTargets() { return []; }
	prepareCapture(_renderer: unknown, camera: THREE.PerspectiveCamera,
		draw: (camera: THREE.PerspectiveCamera) => void) { draw(camera); }
	render(_renderer: unknown, camera: THREE.PerspectiveCamera, _bounds: unknown, _radius: number,
		draw: (camera: THREE.PerspectiveCamera) => void) { draw(camera); }
	dispose() {}
} }));

it('pins separate winding owners sharing live geometry/material, with stable identity and no visible warm owners', () => {
	const ground = new CarouselGround(), model = new THREE.Group(), geometry = new THREE.BoxGeometry();
	model.add(new THREE.Mesh(geometry)); model.updateMatrixWorld(true);
	ground.beginFrame(); ground.shadow({}, model, new THREE.Matrix4(), 0.2); ground.endFrame();
	let scene!: THREE.Scene;
	let owners: THREE.Mesh[] = [];
	const renderer = { render: vi.fn((value: THREE.Scene) => {
		scene = value; scene.updateMatrixWorld(true);
		owners = [];
		scene.traverseVisible(object => { if ((object as THREE.Mesh).isMesh) owners.push(object as THREE.Mesh); });
	}) } as unknown as THREE.WebGPURenderer;
	ground.prepareWindingVariants(renderer, new THREE.PerspectiveCamera());
	expect(owners).toHaveLength(2);
	expect(owners.map(owner => Math.sign(owner.matrixWorld.determinantAffine()))).toEqual([1, -1]);
	expect(owners.every(owner => owner.geometry === geometry)).toBe(true);
	const live = scene.children[0].children[0] as THREE.Mesh;
	expect(owners.every(owner => owner.material === live.material)).toBe(true);
	expect(scene.children.every(child => !child.visible)).toBe(true);
	const firstOwners = [...owners], sourceMatrix = live.matrix.clone();
	ground.prepareWindingVariants(renderer, new THREE.PerspectiveCamera());
	expect(owners[0]).toBe(firstOwners[0]); expect(owners[1]).toBe(firstOwners[1]);
	expect(live.matrix.equals(sourceMatrix)).toBe(true);
	const materialDispose = vi.spyOn(live.material as THREE.Material, 'dispose');
	const geometryDispose = vi.spyOn(geometry, 'dispose');
	ground.dispose();
	expect(scene.children).toHaveLength(0);
	expect(materialDispose).toHaveBeenCalledOnce(); expect(geometryDispose).not.toHaveBeenCalled();
	geometry.dispose();
});

it('restores live and warm visibility when a winding preparation draw throws', () => {
	const ground = new CarouselGround(), model = new THREE.Group();
	model.add(new THREE.Mesh(new THREE.BoxGeometry())); model.updateMatrixWorld(true);
	ground.beginFrame(); ground.shadow({}, model, new THREE.Matrix4(), 0.2); ground.endFrame();
	let scene!: THREE.Scene;
	const renderer = { render: vi.fn((value: THREE.Scene) => { scene = value; throw Error('pipeline'); }) } as unknown as THREE.WebGPURenderer;
	expect(() => ground.prepareWindingVariants(renderer, new THREE.PerspectiveCamera())).toThrow('pipeline');
	expect(scene.children.every(child => !child.visible)).toBe(true);
	ground.dispose();
});

it('projects geometry toward the same light direction while preserving contact points', () => {
	const projection = carouselShadowProjection();
	const contact = new THREE.Vector3(10, 0, 20).applyMatrix4(projection);
	expect(contact.x).toBe(10); expect(contact.z).toBe(20);
	const high = new THREE.Vector3(10, 100, 20).applyMatrix4(projection);
	expect(high.y).toBe(contact.y);
	expect(high.x).toBeLessThan(contact.x); expect(high.z).toBeLessThan(contact.z);
});

it('uses actual triangles without tint or overlapping opacity and releases only owned resources', () => {
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	const ground = new CarouselGround(), key = {};
	const model = new THREE.Group(), geometry = new THREE.BoxGeometry(20, 80, 30);
	model.add(new THREE.Mesh(geometry)); model.position.y = 40; model.updateMatrixWorld(true);
	const renderer = { render: vi.fn() } as unknown as THREE.WebGPURenderer;
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 1000; camera.updateMatrixWorld();
	ground.beginFrame();
	ground.shadow(key, model, new THREE.Matrix4(), 0.2);
	ground.shadow(key, model, new THREE.Matrix4(), 0.2);
	ground.endFrame();
	expect(ground.getStats().silhouettes).toBe(1);
	ground.draw(renderer, camera, 0.5);
	const scene = vi.mocked(renderer.render).mock.calls[0][0];
	const mesh = scene.children[0].children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
	expect(mesh.geometry).toBe(geometry);
	expect(mesh.material.color.getHex()).toBe(0);
	expect(mesh.material.blending).toBe(THREE.NoBlending);
	expect(mesh.material.opacity).toBeCloseTo(0.1);
	const disposeMaterial = vi.spyOn(mesh.material, 'dispose'), disposeGeometry = vi.spyOn(geometry, 'dispose');
	ground.beginFrame(); ground.endFrame();
	expect(disposeMaterial).toHaveBeenCalledOnce(); expect(disposeGeometry).not.toHaveBeenCalled();
	ground.dispose(); expect(ground.getStats().silhouettes).toBe(0);
	vi.unstubAllGlobals();
});
