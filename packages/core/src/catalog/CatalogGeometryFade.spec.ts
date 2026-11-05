import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CatalogGeometryFade } from './CatalogGeometryFade.js';
import { getRefinementSize } from '../stage/SpatialElementRefinement.js';
import type { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';

describe('resolved catalog geometry fade', () => {
	it('retains the warmed capture at high DPI and bounds its physical pixel count', () => {
		const size = getRefinementSize(3000, 1800);
		const warm = new THREE.RenderTarget(size.width, size.height);
		let target: THREE.RenderTarget | null = warm;
		const renderer = {
			getRenderTarget: () => target,
			setRenderTarget: (next: THREE.RenderTarget | null) => { target = next; },
			getDrawingBufferSize: (out: THREE.Vector2) => out.set(3000, 1800),
			getClearColor: (out: THREE.Color) => out.set(0xffffff),
			getClearAlpha: () => 1,
			setClearColor: vi.fn(),
			getScissor: (out: THREE.Vector4) => out.set(0, 0, 1500, 900),
			setScissor: vi.fn(),
			getScissorTest: () => false,
			setScissorTest: vi.fn(),
			clear: vi.fn()
		} as unknown as THREE.WebGPURenderer;
		const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
		const fade = new CatalogGeometryFade();
		try {
			fade.render(renderer, 0.5, () => {});
			const offscreenQuad = quad.mock.contexts.at(-1);
			const capture = fade.getRenderTargets()[0];
			const dispose = vi.spyOn(capture, 'dispose');
			target = null;
			fade.render(renderer, 0.5, () => {});
			const canvasQuad = quad.mock.contexts.at(-1);
			expect(canvasQuad).not.toBe(offscreenQuad);
			expect(canvasQuad!.material).toBe(offscreenQuad!.material);
			// A later speculative High pass must not replace the live Canvas
			// render-object owner and evict its warmed pipeline before a click.
			target = warm; fade.render(renderer, 0.5, () => {});
			expect(quad.mock.contexts.at(-1)).toBe(offscreenQuad);
			target = null; fade.render(renderer, 0.5, () => {});
			expect(quad.mock.contexts.at(-1)).toBe(canvasQuad);
			expect(fade.getRenderTargets()).toEqual([capture]);
			expect(capture.width * capture.height).toBeLessThanOrEqual(512 * 1024);
			expect(capture.width / capture.height).toBeCloseTo(3000 / 1800, 2);
			expect(dispose).not.toHaveBeenCalled();
			expect(target).toBeNull();
		} finally {
			fade.dispose();
			warm.dispose();
			quad.mockRestore();
		}
	});

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

function frozenFixture() {
	let target: THREE.RenderTarget | null = null, canvas = {} as THREE.CanvasTarget;
	const size = new THREE.Vector2(1440, 900), color = new THREE.Color('red');
	const scissor = new THREE.Vector4(7, 8, 900, 600);
	let clearAlpha = 0.4, scissorTest = true, captured = '';
	const renderer = {
		coordinateSystem: THREE.WebGPUCoordinateSystem, toneMapping: THREE.ACESFilmicToneMapping,
		toneMappingExposure: 1, outputColorSpace: THREE.SRGBColorSpace,
		getRenderTarget: () => target, setRenderTarget: (next: THREE.RenderTarget | null) => { target = next; },
		getCanvasTarget: () => canvas,
		getDrawingBufferSize: (out: THREE.Vector2) => out.copy(size),
		getClearColor: (out: THREE.Color) => out.copy(color), getClearAlpha: () => clearAlpha,
		setClearColor: (value: THREE.ColorRepresentation, alpha: number) => { color.set(value); clearAlpha = alpha; },
		getScissor: (out: THREE.Vector4) => out.copy(scissor), setScissor: (value: THREE.Vector4) => scissor.copy(value),
		getScissorTest: () => scissorTest, setScissorTest: (value: boolean) => { scissorTest = value; },
		clear: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	const fade = new CatalogGeometryFade(), source = {}, composites: { captured: string; alpha: number }[] = [];
	const draw = vi.fn(() => { captured = `capture-${draw.mock.calls.length}`; });
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {
		composites.push({ captured, alpha: (fade as unknown as { alpha: { value: number } }).alpha.value });
	});
	return { fade, source, renderer, size, draw, quad, composites,
		setTarget(value: THREE.RenderTarget | null) { target = value; },
		changeCanvas() { canvas = {} as THREE.CanvasTarget; },
		render(alpha = 0.5, token: object | undefined = source, warm?: CatalogWarmOutputContext) {
			fade.render(renderer, alpha, draw, warm, token);
		},
		assertState() {
			expect(target).toBeNull(); expect(color.getHex()).toBe(0xff0000); expect(clearAlpha).toBe(0.4);
			expect(scissor.toArray()).toEqual([7, 8, 900, 600]); expect(scissorTest).toBe(true);
		},
		dispose() { fade.dispose(); quad.mockRestore(); }
	};
}

describe('frozen source capture reuse', () => {
	it('captures the first fractional frame once and composites every later alpha with the same target and material', () => {
		const f = frozenFixture();
		try {
			f.render(0.8); const capture = f.fade.getRenderTargets()[0], owner = f.quad.mock.contexts[0];
			f.render(0.6); f.render(0.2);
			expect(f.draw).toHaveBeenCalledOnce(); expect(f.renderer.clear).toHaveBeenCalledOnce();
			expect(f.composites).toEqual([0.8, 0.6, 0.2].map(alpha => ({ captured: 'capture-1', alpha })));
			expect(f.quad.mock.contexts.every(quad => quad === owner)).toBe(true);
			expect(f.fade.getRenderTargets()).toEqual([capture]); f.assertState();
		} finally { f.dispose(); }
	});

	it.each(['band', 'normal', 'warm', 'opaque', 'hidden', 'renderer', 'canvas', 'resize', 'target', 'exposure', 'capture-dispose', 'dispose'] as const)(
		'never reuses stale pixels after %s changes or replaces the shared scratch', change => {
			const f = frozenFixture(); let output: THREE.RenderTarget | undefined;
			try {
				f.render();
				switch (change) {
					case 'band': f.render(0.4, {}); break;
					case 'normal': f.fade.render(f.renderer, 0.4, f.draw); break;
					case 'warm': f.render(0.4, f.source, { usesCanvasOwner: () => false } as unknown as CatalogWarmOutputContext); break;
					case 'opaque': f.render(1); break;
					case 'hidden': f.render(0); break;
					case 'renderer': f.fade.render({ ...f.renderer } as THREE.WebGPURenderer, 0.4, f.draw, undefined, f.source); break;
					case 'canvas': f.changeCanvas(); break;
					case 'resize': f.size.multiplyScalar(2); break; // Same capped dimensions still invalidate original viewport size.
					case 'target': output = new THREE.RenderTarget(1440, 900); f.setTarget(output); break;
					case 'exposure': f.renderer.toneMappingExposure = 1.2; break;
					case 'capture-dispose': f.fade.getRenderTargets()[0].dispose(); break;
					case 'dispose': f.fade.dispose(); break;
				}
				const before = f.draw.mock.calls.length; f.render(0.3);
				expect(f.draw).toHaveBeenCalledTimes(before + 1);
				expect(f.composites.at(-1)).toEqual({ captured: `capture-${before + 1}`, alpha: 0.3 });
				f.render(0.2); expect(f.draw).toHaveBeenCalledTimes(before + 1);
			} finally { f.dispose(); output?.dispose(); }
		}
	);

	it.each(['capture', 'composite'] as const)('retries a failed %s without publishing a successful capture', failure => {
		const f = frozenFixture();
		try {
			f.render();
			if (failure === 'capture') f.draw.mockImplementationOnce(() => { throw Error('capture failed'); });
			else f.quad.mockImplementationOnce(() => { throw Error('composite failed'); });
			expect(() => f.render(0.4, failure === 'capture' ? {} : f.source)).toThrow(`${failure} failed`);
			f.assertState(); const before = f.draw.mock.calls.length;
			f.render(); expect(f.draw).toHaveBeenCalledTimes(before + 1); f.assertState();
		} finally { f.dispose(); }
	});
});
