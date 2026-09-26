import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { SpatialElementRefinement } from './SpatialElementRefinement.js';

function rendererFixture() {
	const destination = new THREE.RenderTarget(40, 30, { type: THREE.HalfFloatType, samples: 4 });
	let current: THREE.RenderTarget | null = destination;
	const renderer = {
		getRenderTarget: () => current,
		setRenderTarget: (target: THREE.RenderTarget | null) => {
			current = target;
		},
		clear: vi.fn(),
		render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	return { renderer, destination };
}

it('draws High offscreen before revealing it and releases matching temporary targets', () => {
	const { renderer, destination } = rendererFixture();
	const refinement = new SpatialElementRefinement();
	const captures: THREE.RenderTarget[] = [];
	const draws: boolean[] = [];
	refinement.render(
		renderer,
		(high) => {
			draws.push(high);
			captures.push(renderer.getRenderTarget()!);
		},
		true
	);
	expect(draws).toEqual([true, false]);
	expect(refinement.complete).toBe(true);
	expect(renderer.getRenderTarget()).toBe(destination);
	for (const capture of captures) {
		expect(capture).not.toBe(destination);
		expect([capture.width, capture.height, capture.samples, capture.texture.type]).toEqual([
			40,
			30,
			4,
			THREE.HalfFloatType
		]);
	}
	const disposed = captures.map((capture) => vi.spyOn(capture, 'dispose'));
	refinement.dispose();
	refinement.dispose();
	disposed.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
	expect(refinement.targetCount).toBe(0);
});

it('restores renderer ownership on draw failure without declaring High ready', () => {
	const { renderer, destination } = rendererFixture();
	const refinement = new SpatialElementRefinement();
	expect(() =>
		refinement.render(
			renderer,
			() => {
				throw new Error('pipeline failure');
			},
			false
		)
	).toThrow('pipeline failure');
	expect(renderer.getRenderTarget()).toBe(destination);
	expect(refinement.complete).toBe(false);
	expect(refinement.frames).toBe(0);
	refinement.dispose();
});

it('caps temporary attachment area while preserving target format and sample count', () => {
	const { renderer, destination } = rendererFixture();
	destination.setSize(3840, 2160);
	const refinement = new SpatialElementRefinement();
	refinement.render(
		renderer,
		() => {
			const capture = renderer.getRenderTarget()!;
			expect(capture.width * capture.height).toBeLessThanOrEqual(512 * 1024);
			expect(capture.width / capture.height).toBeCloseTo(3840 / 2160, 2);
			expect(capture.samples).toBe(destination.samples);
		},
		true
	);
	refinement.dispose();
});
