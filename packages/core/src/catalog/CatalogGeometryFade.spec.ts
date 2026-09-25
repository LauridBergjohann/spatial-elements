import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CatalogGeometryFade } from './CatalogGeometryFade.js';

describe('resolved catalog geometry fade', () => {
	it('resolves normal depth occlusion before fading and restores renderer state, including on failure', () => {
		const output = new THREE.RenderTarget(800, 600);
		let target: THREE.RenderTarget | null = output;
		let alpha = 1;
		const color = new THREE.Color(0xffffff);
		const scissor = new THREE.Vector4(10, 20, 300, 400);
		let test = true;
		const renderer = {
			getRenderTarget: () => target,
			setRenderTarget: (value: THREE.RenderTarget | null) => {
				target = value;
			},
			getClearColor: (out: THREE.Color) => out.copy(color),
			getClearAlpha: () => alpha,
			setClearColor: (value: THREE.ColorRepresentation, a: number) => {
				color.set(value);
				alpha = a;
			},
			getScissor: (out: THREE.Vector4) => out.copy(scissor),
			setScissor: (value: THREE.Vector4) => scissor.copy(value),
			getScissorTest: () => test,
			setScissorTest: (value: boolean) => {
				test = value;
			},
			clear: vi.fn()
		} as unknown as THREE.WebGPURenderer;
		const solid = new THREE.MeshStandardMaterial();
		const captures = new Set<THREE.RenderTarget>();
		const draw = () => {
			expect(target).not.toBe(output);
			captures.add(target!);
			expect([solid.opacity, solid.transparent, solid.depthWrite]).toEqual([1, false, true]);
			expect(alpha).toBe(0);
		};
		const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(function () {
			expect(target).toBe(output);
		});
		const fade = new CatalogGeometryFade();
		try {
			for (const opacity of [0.2, 0.8, 0.3]) fade.render(renderer, opacity, draw);
			expect(captures.size).toBe(1);
			expect(quad).toHaveBeenCalledTimes(3);
			const capture = [...captures][0];
			const dispose = vi.spyOn(capture, 'dispose');
			expect(() =>
				fade.render(renderer, 0.5, () => {
					throw new Error('draw failure');
				})
			).toThrow('draw failure');
			expect(target).toBe(output);
			expect(alpha).toBe(1);
			expect(color.getHex()).toBe(0xffffff);
			expect(test).toBe(true);
			expect(scissor.toArray()).toEqual([10, 20, 300, 400]);
			const direct = vi.fn();
			fade.render(renderer, 1, direct);
			fade.render(renderer, 0, direct);
			expect(direct).toHaveBeenCalledTimes(1);
			fade.dispose();
			fade.dispose();
			expect(dispose).toHaveBeenCalledTimes(1);
		} finally {
			quad.mockRestore();
			solid.dispose();
			output.dispose();
		}
	});
});
