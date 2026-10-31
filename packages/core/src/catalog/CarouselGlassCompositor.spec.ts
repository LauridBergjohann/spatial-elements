import { afterEach, expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { CarouselGlassCompositor } from './CarouselGlassCompositor.js';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import type { CatalogDepthBlur } from './CatalogDepthBlur.js';
import { LiquidGlassPanel } from '../stage/LiquidGlassPanel.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
	vi.stubGlobal('window', { innerWidth: 800, innerHeight: 600 });
	const original = new THREE.RenderTarget(3, 4);
	let target: THREE.RenderTarget | null = original;
	const color = new THREE.Color('red');
	let alpha = 0.25;
	const clears: { target: THREE.RenderTarget | null; color: number; alpha: number }[] = [];
	const quads: (THREE.RenderTarget | null)[] = [];
	const frames: { matrix: number[]; opacity: number[] }[] = [];
	const renderer = {
		getRenderTarget: () => target,
		setRenderTarget: (next: THREE.RenderTarget | null) => { target = next; },
		getClearColor: (value: THREE.Color) => value.copy(color),
		getClearAlpha: () => alpha,
		setClearColor: (next: THREE.ColorRepresentation, opacity = 1) => { color.set(next); alpha = opacity; },
		getScissorTest: () => true,
		getScissor: (value: THREE.Vector4) => value.set(0, 0, 0, 0),
		setScissorTest: vi.fn(),
		clear: vi.fn(() => { clears.push({ target, color: color.getHex(), alpha }); }),
		clearDepth: vi.fn(),
		render: vi.fn((scene: THREE.Scene) => {
			const group = scene.children.find(child => child.visible)!;
			const opacity: number[] = [];
			group.traverse(child => { if (child instanceof THREE.Mesh) {
				for (const material of Array.isArray(child.material) ? child.material : [child.material]) opacity.push(material.opacity);
			} });
			frames.push({ matrix: group.matrix.toArray(), opacity });
		})
	};
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => { quads.push(target); });
	const depthBlur = { render: vi.fn() };
	const glass = new CarouselGlassCompositor(depthBlur as unknown as CatalogDepthBlur);
	const camera = new THREE.PerspectiveCamera(45, 4 / 3, 1, 4000);
	camera.position.z = 1000; camera.updateMatrixWorld();
	const draw = vi.fn();
	const render = (empty: boolean) => glass.render(renderer as unknown as THREE.WebGPURenderer, camera, draw, empty);
	const card = (blur: number) => ({ dataset: { carouselSurface: 'glass', carouselTheme: JSON.stringify({ backdropBlur: blur }) },
		isConnected: true, setAttribute: vi.fn(), removeAttribute: vi.fn() }) as unknown as HTMLElement;
	const activate = (...cards: HTMLElement[]) => {
		glass.beginFrame();
		for (const node of cards) glass.panel(node, new THREE.Matrix4(), 240, 160, 1);
	};
	const reset = () => { clears.length = 0; quads.length = 0; frames.length = 0; draw.mockClear(); renderer.clearDepth.mockClear(); };
	const restored = () => {
		expect(target).toBe(original); expect(color.getHex()).toBe(0xff0000); expect(alpha).toBe(0.25);
		expect(renderer.getScissor(new THREE.Vector4()).toArray()).toEqual([0, 0, 0, 0]);
		expect(renderer.setScissorTest).not.toHaveBeenCalled();
	};
	return { glass, renderer, camera, depthBlur, draw, quad, clears, quads, frames, card, activate, render, reset, restored,
		dispose: () => { glass.dispose(); original.dispose(); } };
}

test('live → empty → empty → live → empty reuses only the uniform backdrop, while glass matrix and alpha stay live', () => {
	const f = fixture(); const node = f.card(5); f.activate(node);
	f.render(false);
	expect(f.draw).toHaveBeenCalledOnce(); expect(f.quads).toHaveLength(2);
	const [capture, blur] = f.clears.map(clear => clear.target);
	f.reset(); f.render(true);
	expect(f.clears).toEqual([{ target: capture, color: 0, alpha: 0 }, { target: blur, color: 0xffffff, alpha: 1 }]);
	expect(f.quads).toHaveLength(0); expect(f.draw).not.toHaveBeenCalled();
	const firstOpacity = f.frames[0].opacity;
	f.reset(); const matrix = new THREE.Matrix4().makeTranslation(70, -30, 12);
	f.glass.retainFrame(node, matrix, 0, 0.4); f.render(true);
	expect(f.clears).toHaveLength(0); expect(f.quads).toHaveLength(0);
	expect(f.frames).toHaveLength(1); expect(f.frames[0].matrix).toEqual(matrix.toArray());
	expect(f.frames[0].opacity).toEqual(firstOpacity.map(value => value * 0.4));
	expect(f.renderer.clearDepth).toHaveBeenCalledOnce();
	f.activate(node); f.reset(); f.render(false);
	expect(f.draw).toHaveBeenCalledOnce(); expect(f.clears).toHaveLength(2); expect(f.quads).toHaveLength(2);
	f.reset(); f.render(true); expect(f.clears).toHaveLength(2); expect(f.quads).toHaveLength(0);
	f.restored(); f.dispose();
});

test('a live capture invalidates empty results for inactive blur keys too', () => {
	const f = fixture(); const a = f.card(5), b = f.card(12);
	f.activate(a, b); f.render(true);
	const [capture, targetA, targetB] = f.clears.map(clear => clear.target);
	f.activate(a); f.reset(); f.render(false);
	expect(f.clears.map(clear => clear.target)).toEqual([capture, targetA]);
	f.activate(b); f.reset(); f.render(true);
	expect(f.clears).toEqual([{ target: capture, color: 0, alpha: 0 }, { target: targetB, color: 0xffffff, alpha: 1 }]);
	f.activate(a); f.reset(); f.render(true);
	expect(f.clears).toEqual([{ target: targetA, color: 0xffffff, alpha: 1 }]);
	f.restored(); f.dispose();
});

test('resize invalidates every key without replacing targets; a later blur-zero key is seeded at the current size', () => {
	const f = fixture(); const a = f.card(5), b = f.card(12);
	f.activate(a, b); f.render(true);
	const [capture, targetA, targetB] = f.clears.map(clear => clear.target!);
	window.innerWidth = 1024; window.innerHeight = 768;
	f.activate(a); f.reset(); f.render(true);
	expect(f.clears.map(clear => clear.target)).toEqual([capture, targetA]);
	expect([capture.width, capture.height, targetA.width, targetA.height]).toEqual([1024, 768, 1024, 768]);
	f.activate(b); f.reset(); f.render(true);
	expect(f.clears.map(clear => clear.target)).toEqual([targetB]);
	expect([targetB.width, targetB.height]).toEqual([1024, 768]);
	f.activate(f.card(0)); f.reset(); f.render(true);
	expect(f.clears).toHaveLength(1);
	expect([f.clears[0].target!.width, f.clears[0].target!.height]).toEqual([1024, 768]);
	expect(f.clears[0]).toMatchObject({ color: 0xffffff, alpha: 1 });
	f.reset(); f.render(true); expect(f.clears).toHaveLength(0); expect(f.quads).toHaveLength(0);
	f.restored(); f.dispose();
});

test.each([0, 1])('a failed empty clear (%s) restores state and retries the failed seed, including zero-scissor preparation', failedClear => {
	const f = fixture(); f.activate(f.card(5));
	const clear = f.renderer.clear.getMockImplementation()!;
	let call = 0;
	f.renderer.clear.mockImplementation(() => { if (call++ === failedClear) throw new Error('clear failed'); clear(); });
	expect(() => f.render(true)).toThrow('clear failed'); f.restored();
	f.renderer.clear.mockImplementation(clear); f.reset(); f.render(true);
	expect(f.clears).toHaveLength(failedClear === 0 ? 2 : 1);
	expect(f.clears.at(-1)).toMatchObject({ color: 0xffffff, alpha: 1 });
	expect(f.quads).toHaveLength(0);
	f.reset(); f.render(true); expect(f.clears).toHaveLength(0);
	f.restored(); f.dispose();
});

test('a failed live blur cannot reuse any older empty result', () => {
	const f = fixture(); f.activate(f.card(5)); f.render(true);
	f.quad.mockImplementationOnce(() => { throw new Error('blur failed'); });
	expect(() => f.render(false)).toThrow('blur failed'); f.restored();
	f.reset(); f.render(true); expect(f.clears).toHaveLength(2);
	f.restored(); f.dispose();
});

test('an empty backdrop retains live focus blur and restores its sampled UV coordinates', () => {
	const f = fixture(); const node = f.card(5);
	const uv = vi.spyOn(LiquidGlassPanel.prototype, 'setBackdropUvTransform');
	f.glass.panel(node, new THREE.Matrix4(), 240, 160, 1, 4);
	f.depthBlur.render.mockImplementation((_renderer, camera, _rect, _blur, draw) => {
		camera.setViewOffset(800, 600, 10, 20, 400, 300); draw(camera); camera.clearViewOffset();
	});
	f.render(true); f.reset(); f.render(true);
	expect(f.clears).toHaveLength(0); expect(f.depthBlur.render).toHaveBeenCalledTimes(2);
	expect(f.frames).toHaveLength(1); expect(f.renderer.clearDepth).toHaveBeenCalledOnce();
	expect(uv.mock.calls.slice(-2)).toEqual([[10 / 800, 20 / 600, 0.5, 0.5], [0, 0, 1, 1]]);
	f.restored(); f.dispose();
});

test('retained live glass remains rear output with no actors; exit opacity zero alone does not suppress it', () => {
	const f = fixture(); const node = f.card(5); f.activate(node);
	// Exercise the real output predicate and rear forwarding without asset/listener setup.
	const layer = Object.assign(Object.create(CatalogSpatialElementLayer.prototype) as CatalogSpatialElementLayer,
		{ glass: f.glass, actors: new Map(), exitOpacity: 0, carouselUiCamera: f.camera,
			ground: { draw: vi.fn() }, draw: vi.fn() });
	expect(layer.hasCarousel()).toBe(false); expect(layer.hasRearOutput()).toBe(true);
	layer.renderRear(f.renderer as unknown as THREE.WebGPURenderer);
	expect(f.clears).toHaveLength(2); expect(f.quads).toHaveLength(0);
	f.glass.retainFrame(node, new THREE.Matrix4(), 0, 0.5);
	expect(layer.hasRearOutput()).toBe(true);
	f.glass.beginFrame(); f.glass.endFrame();
	expect(layer.hasRearOutput()).toBe(false);
	Object.assign(layer, { actors: new Map([['rear', { pose: {} }]]), exitOpacity: 0.0001 });
	expect(layer.hasRearOutput()).toBe(true);
	Object.assign(layer, { exitOpacity: 0 }); expect(layer.hasRearOutput()).toBe(false);
	f.dispose();
});
