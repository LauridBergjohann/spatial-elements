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

test('resolved preparation stays offscreen, restores borrowed state on failure, and later draws only the saved image', () => {
	const blur = new CatalogDepthBlur(), output = new THREE.RenderTarget(360, 250);
	const saved = new THREE.RenderTarget(256, 256, { type: THREE.HalfFloatType, depthBuffer: false });
	let current: THREE.RenderTarget | null = output, scissorTest = true, alpha = 0.7;
	const canvas = {}, color = new THREE.Color(0x334455);
	const viewport = new THREE.Vector4(0, 0, 1440, 900), scissor = new THREE.Vector4(0, 0, 0, 0);
	const renderer = {
		getCanvasTarget: () => canvas, setCanvasTarget: vi.fn(),
		getRenderTarget: () => current, setRenderTarget: vi.fn((target: THREE.RenderTarget | null) => { current = target; }),
		getClearColor: (value: THREE.Color) => value.copy(color), getClearAlpha: () => alpha,
		setClearColor: (value: THREE.ColorRepresentation, nextAlpha: number) => { color.set(value); alpha = nextAlpha; },
		getViewport: (value: THREE.Vector4) => value.copy(viewport), setViewport: (value: THREE.Vector4) => viewport.copy(value),
		getScissor: (value: THREE.Vector4) => value.copy(scissor), setScissor: (value: THREE.Vector4) => scissor.copy(value),
		getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; }, clear: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	const camera = new THREE.PerspectiveCamera(), rect = { left: 100, top: 200, width: 240, height: 120 };
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	const render = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {
		expect(current).toBe(saved); throw Error('resolve failed');
	});
	try {
		expect(blur.drawResolved(renderer, saved.texture, rect, 0.2)).toBe(false);
		expect(() => blur.prepareResolved(renderer, camera, rect, 2.5, saved, () => {})).toThrow('resolve failed');
		expect(current).toBe(output); expect(color.getHex()).toBe(0x334455); expect(alpha).toBe(0.7);
		expect(scissorTest).toBe(true); expect(viewport.toArray()).toEqual([0, 0, 1440, 900]);
		expect(renderer.setRenderTarget).not.toHaveBeenCalledWith(null);
		render.mockImplementation(() => { expect(current).toBe(saved); });
		blur.prepareResolved(renderer, camera, rect, 2.5, saved, () => {});
		const targets = blur.getRenderTargets(), oldViewport = output.viewport.clone();
		render.mockImplementation(() => { expect(current).toBe(output); expect(output.viewport.equals(oldViewport)).toBe(false); expect(scissorTest).toBe(false); });
		expect(blur.drawResolved(renderer, saved.texture, rect, 0.2)).toBe(true);
		expect(output.viewport.equals(oldViewport)).toBe(true);
		expect(scissorTest).toBe(true);
		expect(blur.getRenderTargets()).toEqual(targets);
		render.mockImplementation(() => { expect(scissorTest).toBe(false); throw Error('composite failed'); });
		expect(() => blur.drawResolved(renderer, saved.texture, rect, 0.2)).toThrow('composite failed');
		expect(output.viewport.equals(oldViewport)).toBe(true); expect(scissorTest).toBe(true);
		// The same real Canvas owner is warmed without lifting its zero-area scissor.
		current = null;
		for (const preparing of [false, true]) {
			render.mockImplementation(() => { expect(current).toBe(null); expect(scissorTest).toBe(preparing); });
			blur.drawResolved(renderer, saved.texture, rect, 0.2, preparing);
			expect(scissorTest).toBe(true);
			blur.render(renderer, camera, rect, 2.5, () => { expect(scissorTest).toBe(false); }, undefined, preparing);
			expect(scissorTest).toBe(true);
		}
	} finally { render.mockRestore(); vi.unstubAllGlobals(); blur.dispose(); output.dispose(); saved.dispose(); }
});
