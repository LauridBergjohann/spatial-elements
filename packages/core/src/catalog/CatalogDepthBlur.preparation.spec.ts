import * as THREE from 'three/webgpu';
import { expect, test, vi } from 'vitest';
import { CatalogDepthBlur } from './CatalogDepthBlur.js';

test('warm draws borrow the same bounded DepthBlur capture and never resolve onto the visible output', () => {
	const blur = new CatalogDepthBlur(), destination = new THREE.RenderTarget(4, 4);
	let current: THREE.RenderTarget | null = destination;
	const renderer = {
		getRenderTarget: () => current,
		setRenderTarget: vi.fn((target: THREE.RenderTarget | null) => { current = target; }),
		render: vi.fn(), clear: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	const camera = new THREE.PerspectiveCamera();
	const captured: THREE.RenderTarget[] = [];
	const draw = vi.fn((projection: THREE.PerspectiveCamera) => {
		expect(projection.projectionMatrix.equals(camera.projectionMatrix)).toBe(true);
		expect(current).not.toBe(destination); captured.push(current!);
	});
	blur.prepareCapture(renderer, camera, draw);
	blur.prepareCapture(renderer, camera, draw);
	expect(captured[0]).toBe(captured[1]);
	expect(captured[0]).toMatchObject({ width: 512, height: 512 });
	expect(captured[0].texture.type).toBe(THREE.HalfFloatType);
	expect(blur.getRenderTargets()[0]).toBe(captured[0]);
	expect(current).toBe(destination);
	expect(renderer.render).not.toHaveBeenCalled(); expect(renderer.clear).not.toHaveBeenCalled();
	expect(blur.getStats().passes).toBe(0);
	expect(() => blur.prepareCapture(renderer, camera, () => { throw Error('warm failed'); })).toThrow('warm failed');
	expect(current).toBe(destination);
	expect(renderer.setRenderTarget).not.toHaveBeenCalledWith(null);
	blur.dispose(); destination.dispose();
});
