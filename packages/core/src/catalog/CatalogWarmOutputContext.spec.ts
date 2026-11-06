import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { CatalogWarmOutputContext } from './CatalogWarmOutputContext.js';
import { CatalogGeometryFade } from './CatalogGeometryFade.js';
import { CatalogModelOutline } from './CatalogModelOutline.js';
import { CatalogDepthBlur } from './CatalogDepthBlur.js';
import { DEFAULT_INTERACTION_THEME } from '../stage/stageConstants.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function fixture() {
	const canvas = new THREE.CanvasTarget({ width: 800, height: 600, style: {} } as HTMLCanvasElement);
	canvas.setPixelRatio(1.5);
	let target: THREE.RenderTarget | null = null, alpha = 1;
	const color = new THREE.Color(0xffffff);
	const renderer = {
		backend: { isWebGPUBackend: true }, coordinateSystem: THREE.WebGPUCoordinateSystem,
		getCanvasTarget: () => canvas, getOutputBufferType: () => THREE.HalfFloatType,
		samples: 4, depth: true, stencil: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
		outputColorSpace: THREE.SRGBColorSpace, xr: { isPresenting: false }, getMRT: () => null,
		getOutputRenderTarget: () => null, getRenderObjectFunction: () => null, getRenderTarget: () => target,
		setRenderTarget: (value: THREE.RenderTarget | null) => { target = value; }, setCanvasTarget: vi.fn(),
		getDrawingBufferSize: (value: THREE.Vector2) => canvas.getDrawingBufferSize(value),
		getPixelRatio: () => canvas.getPixelRatio(),
		getClearColor: (value: THREE.Color) => value.copy(color), getClearAlpha: () => alpha,
		setClearColor: (value: THREE.ColorRepresentation, next: number) => { color.set(value); alpha = next; },
		getScissor: (value: THREE.Vector4) => canvas.getScissor(value), setScissor: (value: THREE.Vector4) => canvas.setScissor(value),
		getViewport: (value: THREE.Vector4) => canvas.getViewport(value), setViewport: (value: THREE.Vector4) => canvas.setViewport(value),
		getScissorTest: () => canvas.getScissorTest(), setScissorTest: (value: boolean) => canvas.setScissorTest(value),
		clear: vi.fn(), render: vi.fn()
	} as unknown as THREE.WebGPURenderer;
	return { canvas, renderer };
}

test('scratch derives its physical attachment profile without using an existing output target', () => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	try {
		expect(context).toBeDefined(); expect(context.isCurrent(f.renderer)).toBe(true);
		expect(context.target).toMatchObject({ width: 1200, height: 900, samples: 4, depthBuffer: true, stencilBuffer: false });
		expect(context.target.texture).toMatchObject({ type: THREE.HalfFloatType, format: THREE.RGBAFormat,
			colorSpace: THREE.LinearSRGBColorSpace, generateMipmaps: false });
		const another = CatalogWarmOutputContext.create(f.renderer, () => true)!;
		expect(another.target).not.toBe(context.target); expect(another.profileKey).not.toBe(context.profileKey); another.dispose();
	} finally { context.dispose(); f.canvas.dispose(); }
});

test.each(['fade', 'outline', 'ground-resolve'] as const)('scratch %s warms the exact Canvas owner while nested and later High captures retain their other owner', kind => {
	vi.stubGlobal('innerWidth', 800); vi.stubGlobal('innerHeight', 600);
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	const high = new THREE.RenderTarget(1200, 900), saved = new THREE.RenderTarget(256, 256, { type: THREE.HalfFloatType });
	const fade = new CatalogGeometryFade(), outline = new CatalogModelOutline(), blur = new CatalogDepthBlur();
	const camera = new THREE.PerspectiveCamera(), model = new THREE.Group();
	const rect = { left: 100, top: 100, width: 200, height: 100 }, clip = { left: 0, top: 0, width: 800, height: 600 };
	const quad = vi.spyOn(THREE.QuadMesh.prototype, 'render').mockImplementation(() => {});
	const draw = (warm?: CatalogWarmOutputContext) => {
		if (kind === 'fade') fade.render(f.renderer, 0.5, () => {}, warm);
		if (kind === 'outline') outline.render(f.renderer, camera, model, rect, clip, 0.5, DEFAULT_INTERACTION_THEME, warm);
		if (kind === 'ground-resolve') expect(blur.drawResolved(f.renderer, saved.texture, rect, 0.5, false, warm)).toBe(true);
	};
	try {
		blur.prepareResolved(f.renderer, camera, rect, 2.5, saved, () => {});
		context.borrow(f.renderer, () => {
			f.renderer.setRenderTarget(context.target); draw(context);
			const canvasOwner = quad.mock.contexts.at(-1);
			f.renderer.setRenderTarget(high); draw(context);
			expect(quad.mock.contexts.at(-1)).not.toBe(canvasOwner);
			f.renderer.setRenderTarget(context.target); draw(context);
			expect(quad.mock.contexts.at(-1)).toBe(canvasOwner);
			f.renderer.setRenderTarget(null);
		});
		const warmedCanvasOwner = quad.mock.contexts.at(-1);
		f.renderer.setRenderTarget(high); draw(); const highOwner = quad.mock.contexts.at(-1);
		f.renderer.setRenderTarget(null); draw();
		expect(quad.mock.contexts.at(-1)).toBe(warmedCanvasOwner);
		expect(highOwner).not.toBe(warmedCanvasOwner);
	} finally { fade.dispose(); outline.dispose(); blur.dispose(); high.dispose(); saved.dispose(); context.dispose(); f.canvas.dispose(); }
});

test.each(['type', 'samples', 'depth', 'stencil', 'reversed-depth', 'tone', 'color', 'xr', 'mrt', 'output', 'callback', 'viewport', 'scissor', 'webgl'] as const)(
	'unknown %s profile declines instead of assuming compatibility', field => {
	const f = fixture();
	if (field === 'type') f.renderer.getOutputBufferType = () => THREE.UnsignedByteType;
	if (field === 'samples') Object.assign(f.renderer, { samples: 0 });
	if (field === 'depth') f.renderer.depth = false;
	if (field === 'stencil') f.renderer.stencil = true;
	if (field === 'reversed-depth') Object.assign(f.renderer, { reversedDepthBuffer: true });
	if (field === 'tone') f.renderer.toneMapping = THREE.NoToneMapping;
	if (field === 'color') f.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
	if (field === 'xr') Object.assign(f.renderer.xr, { isPresenting: true });
	if (field === 'mrt') f.renderer.getMRT = () => ({} as THREE.MRTNode);
	if (field === 'output') f.renderer.getOutputRenderTarget = () => ({} as THREE.RenderTarget);
	if (field === 'callback') f.renderer.getRenderObjectFunction = () => (() => {});
	if (field === 'viewport') f.canvas.setViewport(1, 0, 800, 600);
	if (field === 'scissor') f.canvas.setScissorTest(true);
	if (field === 'webgl') Object.assign(f.renderer.backend, { isWebGPUBackend: false });
	expect(CatalogWarmOutputContext.create(f.renderer, () => true)).toBeUndefined(); f.canvas.dispose();
});

test.each(['resize', 'dispose', 'profile', 'owner', 'attachment'] as const)('stale %s can never revive an existing generation', cause => {
	const f = fixture(); let current = true;
	const context = CatalogWarmOutputContext.create(f.renderer, () => current)!;
	const dispose = vi.spyOn(context.target, 'dispose');
	if (cause === 'resize') { f.canvas.setSize(900, 600); f.canvas.setSize(800, 600); }
	if (cause === 'dispose') f.canvas.dispose();
	if (cause === 'profile') f.renderer.toneMappingExposure = 2;
	if (cause === 'owner') current = false;
	if (cause === 'attachment') context.target.setSize(20, 20);
	expect(context.isCurrent(f.renderer)).toBe(false);
	expect(() => context.borrow(f.renderer, () => {})).toThrow('stale');
	// RenderTarget.setSize already releases its old GPU storage; verify owner disposal separately.
	dispose.mockClear();
	context.dispose(); context.dispose(); expect(dispose).toHaveBeenCalledOnce();
	expect(context.isCurrent(f.renderer)).toBe(false); f.canvas.dispose();
});

test.each(['size', 'dpr'] as const)('another selected Canvas with a different %s cannot borrow this profile', field => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	if (field === 'size') f.renderer.getDrawingBufferSize = value => value.set(800, 600);
	else f.renderer.getPixelRatio = () => 2;
	expect(context.isCurrent(f.renderer)).toBe(false);
	expect(() => context.borrow(f.renderer, () => {})).toThrow('stale');
	context.dispose(); f.canvas.dispose();
});

test.each([false, true])('borrow restores target viewport/scissor and bounds Canvas owner selection (throw %s)', fail => {
	const f = fixture(), context = CatalogWarmOutputContext.create(f.renderer, () => true)!;
	const nested = new THREE.RenderTarget(40, 20);
	context.target.viewport.set(3, 5, 90, 80); context.target.scissor.set(7, 9, 10, 11); context.target.scissorTest = false;
	expect(context.usesCanvasOwner(context.target)).toBe(false);
	const run = () => context.borrow(f.renderer, () => {
		expect(context.target.viewport.toArray()).toEqual([0, 0, 1200, 900]);
		expect(context.target.scissor.toArray()).toEqual([0, 0, 0, 0]); expect(context.target.scissorTest).toBe(true);
		expect(context.usesCanvasOwner(context.target)).toBe(true); expect(context.usesCanvasOwner(nested)).toBe(false);
		expect(context.usesCanvasOwner(null)).toBe(false);
		expect(() => context.borrow(f.renderer, () => {})).toThrow('already in use');
		context.target.viewport.set(0, 0, 1, 1); context.target.scissor.set(1, 1, 1, 1); context.target.scissorTest = false;
		if (fail) throw Error('draw failed');
	});
	if (fail) expect(run).toThrow('draw failed'); else run();
	expect(context.target.viewport.toArray()).toEqual([3, 5, 90, 80]);
	expect(context.target.scissor.toArray()).toEqual([7, 9, 10, 11]); expect(context.target.scissorTest).toBe(false);
	expect(context.usesCanvasOwner(context.target)).toBe(false);
	context.dispose(); nested.dispose(); f.canvas.dispose();
});
