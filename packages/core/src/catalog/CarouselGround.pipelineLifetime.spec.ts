import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
// Exercise the installed Three cache/owner lifetime, not a copy of its policy.
import Pipelines from 'three/src/renderers/common/Pipelines.js';
import WebGPUBackend from 'three/src/renderers/webgpu/WebGPUBackend.js';

function fixture() {
	const backend = new WebGPUBackend();
	Object.assign(backend.utils, {
		getSampleCountRenderContext: () => 1,
		getCurrentColorSpace: () => THREE.LinearSRGBColorSpace,
		getCurrentColorFormat: () => 'rgba16float',
		getCurrentDepthStencilFormat: () => 'depth24plus',
		getPrimitiveTopology: () => 'triangle-list'
	});
	backend.createProgram = vi.fn();
	backend.createRenderPipeline = vi.fn();
	const pipelines = new Pipelines(backend, {}, { createProgram: vi.fn(), destroyProgram: vi.fn() });
	const material = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide,
		blending: THREE.NoBlending, depthTest: false, depthWrite: false, toneMapped: false });
	const geometry = new THREE.BoxGeometry();
	const builder = { vertexShader: 'same-ground-vertex', fragmentShader: 'same-ground-fragment' };
	const owners: object[] = [];
	function mesh(sign: number) {
		const object = new THREE.Mesh(geometry, material);
		object.matrixWorld.makeScale(sign, 1, 1);
		const passes = [THREE.BackSide, THREE.FrontSide].map(side => {
			const owner = { object, material, context: {}, clippingContextCacheKey: '',
				getNodeBuilderState: () => builder, getGeometryCacheKey: () => 'shared-ground-layout' };
			owners.push(owner);
			return { side, owner };
		});
		return { object, draw() {
			for (const { side, owner } of passes) {
				material.side = side;
				pipelines.getForRender(owner);
			}
			material.side = THREE.DoubleSide;
		} };
	}
	return { backend, pipelines, mesh, dispose() {
		owners.forEach(owner => pipelines.delete(owner));
		geometry.dispose(); material.dispose();
	} };
}

test('warming both winding signs on one live owner loses the first Three pipeline variants', () => {
	const f = fixture(), live = f.mesh(1);
	live.draw();
	live.object.matrixWorld.makeScale(-1, 1, 1); live.draw();
	expect(f.backend.createRenderPipeline).toHaveBeenCalledTimes(4);
	live.object.matrixWorld.makeScale(1, 1, 1); live.draw();
	expect(f.backend.createRenderPipeline).toHaveBeenCalledTimes(6);
	f.dispose();
});

test('persistent owners pin both actual Three winding/pass keys through repeated live switches', () => {
	const f = fixture(), positive = f.mesh(1), negative = f.mesh(-1), live = f.mesh(1);
	positive.draw(); negative.draw();
	expect(f.backend.createRenderPipeline).toHaveBeenCalledTimes(4);
	for (const sign of [1, -1, 1, -1, 1]) {
		live.object.matrixWorld.makeScale(sign, 1, 1); live.draw();
	}
	expect(f.backend.createRenderPipeline).toHaveBeenCalledTimes(4);
	expect(f.pipelines.caches.size).toBe(4);
	f.dispose();
	expect(f.pipelines.caches.size).toBe(0);
});
