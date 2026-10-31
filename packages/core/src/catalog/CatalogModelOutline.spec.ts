import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { CatalogModelOutline } from './CatalogModelOutline.js';
import { DEFAULT_INTERACTION_THEME } from '../stage/stageConstants.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
	vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 900);
	let target: THREE.RenderTarget | null = null, scissorTest = true, alpha = 1;
	const scissor = new THREE.Vector4(0, 0, 0, 0), viewport = new THREE.Vector4(0, 0, 1440, 900), color = new THREE.Color(0xffffff);
	const renderer = {
		getRenderTarget: () => target, setRenderTarget: (value: THREE.RenderTarget | null) => { target = value; },
		getViewport: (out: THREE.Vector4) => out.copy(viewport), setViewport: (value: THREE.Vector4) => viewport.copy(value),
		getScissor: (out: THREE.Vector4) => out.copy(scissor), setScissor: (value: THREE.Vector4) => scissor.copy(value),
		getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; },
		getClearColor: (out: THREE.Color) => out.copy(color), getClearAlpha: () => alpha,
		setClearColor: (value: THREE.ColorRepresentation, opacity: number) => { color.set(value); alpha = opacity; },
		clear: vi.fn(), render: vi.fn(() => { expect(target).not.toBeNull(); expect(scissorTest).toBe(false); })
	} as unknown as THREE.WebGPURenderer;
	const model = new THREE.Group();
	const camera = new THREE.PerspectiveCamera(); camera.position.z = 5; camera.updateMatrixWorld();
	const outline = new CatalogModelOutline();
	const draw = () => outline.render(renderer, camera, model, { left: 400, top: 200, width: 200, height: 200 },
		{ left: 0, top: 0, width: 1440, height: 900 }, 0.5, DEFAULT_INTERACTION_THEME);
	return { renderer, outline, model, draw, scissor, viewport, color, get target() { return target; },
		get scissorTest() { return scissorTest; }, get alpha() { return alpha; } };
}

test('idle preparation renders its mask but preserves the zero-area Canvas output scissor', () => {
	const f = fixture();
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {
		expect(f.target).toBeNull(); expect(f.scissorTest).toBe(true);
		expect(f.scissor.toArray()).toEqual([0, 0, 0, 0]);
	});
	try {
		f.draw();
		expect(f.renderer.render).toHaveBeenCalledOnce(); expect(quad).toHaveBeenCalledOnce();
		expect(f.viewport.toArray()).toEqual([0, 0, 1440, 900]);
		expect(f.scissorTest).toBe(true); expect(f.color.getHex()).toBe(0xffffff); expect(f.alpha).toBe(1);
	} finally { f.outline.dispose(); }
});

test('Canvas and offscreen output retain separate pipeline owners while sharing the prepared mask and material', () => {
	const f = fixture(), output = new THREE.RenderTarget(800, 600);
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
	try {
		f.draw(); const canvasOwner = quad.mock.contexts.at(-1), capture = f.outline.getRenderTargets()[0];
		f.renderer.setRenderTarget(output); f.draw(); const offscreenOwner = quad.mock.contexts.at(-1);
		expect(offscreenOwner).not.toBe(canvasOwner); expect(offscreenOwner!.material).toBe(canvasOwner!.material);
		f.renderer.setRenderTarget(null); f.draw(); expect(quad.mock.contexts.at(-1)).toBe(canvasOwner);
		f.renderer.setRenderTarget(output); f.draw(); expect(quad.mock.contexts.at(-1)).toBe(offscreenOwner);
		expect(f.outline.getRenderTargets()).toEqual([capture]);
		expect(f.renderer.render).toHaveBeenCalledOnce();
	} finally { f.outline.dispose(); output.dispose(); }
});

test('a failed mask submission restores the source output, clipping, viewport and clear state', () => {
	const f = fixture();
	vi.mocked(f.renderer.render).mockImplementation(() => { throw new Error('mask submission'); });
	try {
		expect(f.draw).toThrow('mask submission');
		expect(f.target).toBeNull(); expect(f.scissorTest).toBe(true);
		expect(f.scissor.toArray()).toEqual([0, 0, 0, 0]);
		expect(f.viewport.toArray()).toEqual([0, 0, 1440, 900]);
		expect(f.color.getHex()).toBe(0xffffff); expect(f.alpha).toBe(1);
	} finally { f.outline.dispose(); }
});
