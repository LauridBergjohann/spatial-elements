import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CarouselGround, carouselShadowProjection } from './CarouselGround.js';

vi.mock('./CatalogDepthBlur.js', () => ({ CatalogDepthBlur: class {
	getRenderTargets() { return []; }
	render(_renderer: unknown, camera: THREE.PerspectiveCamera, _bounds: unknown, _radius: number,
		draw: (camera: THREE.PerspectiveCamera) => void) { draw(camera); }
	dispose() {}
} }));

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
