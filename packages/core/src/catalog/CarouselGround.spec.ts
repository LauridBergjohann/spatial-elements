import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CarouselGround } from './CarouselGround.js';

it('shares patches across updates, fades during handoff and releases unused resources', () => {
	const ground = new CarouselGround(), section = {}, product = {};
	const matrix = new THREE.Matrix4().makeRotationX(0.1);
	const renderer = { render: vi.fn() } as unknown as THREE.WebGPURenderer;
	ground.beginFrame();
	ground.patch(section, matrix, 1000, 1000, 0.035);
	ground.patch(section, matrix, 1000, 1000, 0.035);
	ground.patch(product, matrix, 200, 150, 0.22);
	ground.endFrame();
	expect(ground.getStats().patches).toBe(2);
	ground.draw(renderer, new THREE.PerspectiveCamera(), 0.5);
	const scene = vi.mocked(renderer.render).mock.calls[0][0];
	const meshes = scene.children as THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
	expect(meshes[1].material.opacity).toBeCloseTo(0.11);
	const disposed = vi.spyOn(meshes[1].material, 'dispose');
	ground.beginFrame();
	ground.patch(section, matrix, 1000, 1000, 0.035);
	ground.endFrame();
	expect(disposed).toHaveBeenCalledOnce();
	ground.dispose();
	expect(ground.getStats().patches).toBe(0);
});
