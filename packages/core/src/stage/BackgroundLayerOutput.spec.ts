import * as THREE from 'three/webgpu';
import { afterEach, expect, test, vi } from 'vitest';
import { BackgroundLayerOutput } from './BackgroundLayerOutput.js';

const cleanups: (() => void)[] = [];
afterEach(() => { while (cleanups.length) cleanups.pop()!(); vi.restoreAllMocks(); });

function fixture() {
	const ownCanvas = new THREE.CanvasTarget({ width: 160, height: 120, style: {} } as HTMLCanvasElement);
	ownCanvas.setPixelRatio(1.5);
	const otherCanvas = new THREE.CanvasTarget({ width: 70, height: 50, style: {} } as HTMLCanvasElement);
	otherCanvas.setViewport(1, 2, 50, 40); otherCanvas.setScissor(3, 4, 20, 10); otherCanvas.setScissorTest(true);
	const previousTarget = new THREE.RenderTarget(30, 20);
	let canvas = otherCanvas, target: THREE.RenderTarget | null = previousTarget, output: THREE.RenderTarget | null = null;
	let face = 2, mip = 3, alpha = 0.25, depth = 1, stencil = 0;
	let mrt: THREE.MRTNode | null = null, renderObject: ReturnType<THREE.WebGPURenderer['getRenderObjectFunction']> = null;
	const color = new THREE.Color(0x123456), events: string[] = [];
	const renderer = {
		backend: { isWebGPUBackend: true }, coordinateSystem: THREE.WebGPUCoordinateSystem,
		samples: 4, depth: true, stencil: false, reversedDepthBuffer: false,
		toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace,
		xr: { enabled: true, isPresenting: false }, autoClear: false, autoClearColor: false, autoClearDepth: true, autoClearStencil: false,
		getOutputBufferType: () => THREE.HalfFloatType,
		getCanvasTarget: () => canvas, setCanvasTarget: (next: THREE.CanvasTarget) => { canvas = next; },
		getRenderTarget: () => target, setRenderTarget: (next: THREE.RenderTarget | null, nextFace = 0, nextMip = 0) => { target = next; face = nextFace; mip = nextMip; },
		getOutputRenderTarget: () => output, setOutputRenderTarget: (next: THREE.RenderTarget | null) => { output = next; },
		getActiveCubeFace: () => face, getActiveMipmapLevel: () => mip,
		getMRT: () => mrt, setMRT: (next: THREE.MRTNode | null) => { mrt = next; },
		getRenderObjectFunction: () => renderObject, setRenderObjectFunction: (next: typeof renderObject) => { renderObject = next; },
		getViewport: (out: THREE.Vector4) => canvas.getViewport(out),
		setViewport: (x: number | THREE.Vector4, y?: number, width?: number, height?: number, minDepth?: number, maxDepth?: number) => {
			if (typeof x === 'number') canvas.setViewport(x, y!, width!, height!, minDepth, maxDepth);
			else canvas.setViewport(x);
		},
		getScissor: (out: THREE.Vector4) => canvas.getScissor(out), setScissor: (next: THREE.Vector4) => { canvas.setScissor(next); },
		getScissorTest: () => canvas.getScissorTest(), setScissorTest: (next: boolean) => { canvas.setScissorTest(next); },
		getClearColor: (out: THREE.Color) => out.copy(color), getClearAlpha: () => alpha,
		setClearColor: (next: THREE.ColorRepresentation, opacity: number) => { color.set(next); alpha = opacity; },
		getClearDepth: () => depth, setClearDepth: (next: number) => { depth = next; },
		getClearStencil: () => stencil, setClearStencil: (next: number) => { stencil = next; },
		clear: vi.fn(() => { events.push('clear'); })
	} as unknown as THREE.WebGPURenderer;
	const publish = vi.spyOn(THREE.RenderPipeline.prototype, 'render').mockImplementation(() => { events.push('publish'); });
	const pipelineDispose = vi.spyOn(THREE.RenderPipeline.prototype, 'dispose');
	const display = { render: vi.fn(() => { events.push('display'); }) };
	const create = () => {
		const owner = BackgroundLayerOutput.create(renderer, ownCanvas);
		if (owner) cleanups.push(() => owner.dispose());
		return owner;
	};
	cleanups.push(() => { ownCanvas.dispose(); otherCanvas.dispose(); previousTarget.dispose(); });
	const state = () => ({ canvas, target, output, face, mip, mrt, renderObject,
		viewport: renderer.getViewport(new THREE.Vector4()).toArray(), scissor: renderer.getScissor(new THREE.Vector4()).toArray(), test: renderer.getScissorTest(),
		ownViewport: ownCanvas.getViewport(new THREE.Vector4()).toArray(), ownScissor: ownCanvas.getScissor(new THREE.Vector4()).toArray(), ownTest: ownCanvas.getScissorTest(),
		color: color.getHex(), alpha, depth, stencil, auto: renderer.autoClear, colorClear: renderer.autoClearColor, depthClear: renderer.autoClearDepth, stencilClear: renderer.autoClearStencil,
		tone: renderer.toneMapping, exposure: renderer.toneMappingExposure, space: renderer.outputColorSpace, xr: renderer.xr.enabled });
	return { renderer, ownCanvas, otherCanvas, create, publish, pipelineDispose, display, events, state };
}

test('constructing the independent output allocates only one owned linear target and submits nothing', () => {
	const f = fixture(), owner = f.create()!;
	expect(owner).toBeDefined(); expect(f.events).toEqual([]);
	expect(owner.getRenderTargets()).toHaveLength(1);
	expect(owner.getRenderTargets()[0]).toMatchObject({ width: 240, height: 180, samples: 4, depthBuffer: true, stencilBuffer: false });
	expect(owner.getRenderTargets()[0].texture).toMatchObject({ type: THREE.HalfFloatType, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace, generateMipmaps: false });
	expect(owner.publish()).toBe(false); expect(f.publish).not.toHaveBeenCalled();
});

test('complete composition uses the proven clear/display/panels order and publishes exactly once', () => {
	const f = fixture(), owner = f.create()!, before = f.state(), target = owner.getRenderTargets()[0];
	f.display.render.mockImplementation(() => {
		f.events.push('display'); expect(f.renderer.getRenderTarget()).toBe(target);
		expect([f.renderer.autoClear, f.renderer.autoClearColor, f.renderer.autoClearDepth, f.renderer.autoClearStencil]).toEqual([true, true, true, true]);
		expect(f.renderer.getClearAlpha()).toBe(1); expect(target.scissorTest).toBe(false);
	});
	f.publish.mockImplementation(() => {
		f.events.push('publish'); expect(f.renderer.getRenderTarget()).toBeNull();
		expect(f.renderer.getCanvasTarget()).toBe(f.ownCanvas); expect(f.renderer.autoClear).toBe(false);
	});
	expect(owner.compose(f.display, () => {
		expect(f.renderer.autoClear).toBe(false); expect(f.renderer.getRenderTarget()).toBe(target);
		f.events.push('regular-panel', 'minimap-panel');
	})).toBe(true);
	expect(f.events).toEqual(['display', 'regular-panel', 'minimap-panel', 'publish']);
	expect(f.renderer.clear).not.toHaveBeenCalled(); expect(f.state()).toEqual(before);
	expect(owner.getStats()).toMatchObject({ contentsValid: true, publications: 1 });
});

test('transparent clear rebuilds all attachments and can prepare without publishing', () => {
	const f = fixture(), owner = f.create()!, before = f.state();
	f.renderer.clear = vi.fn((...args) => {
		expect(args).toEqual([true, true, true]); expect(f.renderer.getClearAlpha()).toBe(0);
		expect(f.renderer.getClearColor(new THREE.Color()).getHex()).toBe(0);
	});
	expect(owner.clearTransparent(false)).toBe(true); expect(f.publish).not.toHaveBeenCalled();
	expect(owner.publish()).toBe(true); expect(f.publish).toHaveBeenCalledOnce(); expect(f.state()).toEqual(before);
});

test.each([false, true])('scratch invalidates contents before any work and cannot publish, including failure (%s)', fail => {
	const f = fixture(), owner = f.create()!; owner.compose(f.display, () => {});
	const handle = owner.captureScratch()!, before = f.state(); f.publish.mockClear();
	handle.target.viewport.set(1, 2, 30, 40); handle.target.scissor.set(3, 4, 5, 6); handle.target.scissorTest = true;
	const draw = () => handle.borrow(() => {
		expect(owner.getStats().contentsValid).toBe(false); expect(f.renderer.getRenderTarget()).toBe(handle.target);
		expect(() => owner.publish()).toThrow('already in use');
		expect(() => owner.clearTransparent()).toThrow('already in use');
		expect(() => handle.borrow(() => {})).toThrow('already in use');
		// Arbitrary destructive pixels are permitted; there is deliberately no restore-copy.
		f.renderer.clear();
		if (fail) throw Error('scratch failed');
	});
	if (fail) expect(draw).toThrow('scratch failed'); else expect(draw()).toBe(true);
	expect(handle.isCurrent()).toBe(true); expect(owner.publish()).toBe(false); expect(f.publish).not.toHaveBeenCalled();
	expect(f.state()).toEqual(before); expect(handle.target.viewport.toArray()).toEqual([1, 2, 30, 40]);
	expect(handle.target.scissor.toArray()).toEqual([3, 4, 5, 6]); expect(handle.target.scissorTest).toBe(true);
	expect(owner.clearTransparent()).toBe(true); expect(f.publish).toHaveBeenCalledOnce();
});

test.each(['display', 'panels', 'publish'] as const)('exceptions in %s restore complete renderer state and require a fresh composition', phase => {
	const f = fixture(), owner = f.create()!, before = f.state();
	const fail = () => {
		f.renderer.setOutputRenderTarget(new THREE.RenderTarget(1, 1));
		f.renderer.toneMapping = THREE.NoToneMapping; f.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
		f.renderer.toneMappingExposure = 9; f.renderer.xr.enabled = false;
		f.renderer.setViewport(new THREE.Vector4(7, 8, 9, 10)); f.renderer.setClearDepth(0.2); f.renderer.setClearStencil(5);
		f.renderer.setMRT({} as THREE.MRTNode); f.renderer.setRenderObjectFunction(() => {});
		throw Error('draw failed');
	};
	if (phase === 'display') f.display.render.mockImplementation(fail);
	if (phase === 'publish') f.publish.mockImplementation(fail);
	expect(() => owner.compose(f.display, phase === 'panels' ? fail : () => {})).toThrow('draw failed');
	expect(f.state()).toEqual(before); expect(owner.getStats()).toMatchObject({ contentsValid: false, busy: false });
	expect(owner.publish()).toBe(false);
	f.display.render.mockImplementation(() => {}); f.publish.mockImplementation(() => {});
	expect(owner.compose(f.display, () => {})).toBe(true);
});

test('composition cannot silently redirect the output or escape with an asynchronous callback', () => {
	const f = fixture(), owner = f.create()!, before = f.state();
	expect(() => owner.compose(f.display, () => { f.renderer.setRenderTarget(null); })).toThrow('destination');
	expect(() => owner.compose(f.display, () => Promise.resolve())).toThrow('synchronous');
	expect(() => owner.captureScratch()!.borrow(() => Promise.resolve())).toThrow('synchronous');
	expect(f.state()).toEqual(before); expect(owner.publish()).toBe(false); expect(f.publish).not.toHaveBeenCalled();
});

test('Canvas resize invalidates handles immediately, resizes the same allocation, and requires a new complete frame', () => {
	const f = fixture(), owner = f.create()!, handle = owner.captureScratch()!, target = handle.target;
	owner.clearTransparent(); f.publish.mockClear();
	f.ownCanvas.setSize(200, 140, false);
	expect(handle.isCurrent()).toBe(false); expect(handle.borrow(() => { throw Error('stale draw'); })).toBe(false);
	expect(owner.publish()).toBe(false); expect(owner.captureScratch()).toBeUndefined();
	expect(owner.resize()).toBe(true); expect(owner.getRenderTargets()).toEqual([target]);
	expect(target).toMatchObject({ width: 300, height: 210 }); expect(owner.publish()).toBe(false);
	expect(owner.clearTransparent()).toBe(true); expect(f.publish).toHaveBeenCalledOnce();
	expect(handle.isCurrent()).toBe(false); expect(owner.captureScratch()!.isCurrent()).toBe(true);
});

test('resize or owner disposal during a callback prevents stale contents becoming publishable', () => {
	const f = fixture(), owner = f.create()!;
	expect(() => owner.compose(f.display, () => { f.ownCanvas.setSize(200, 140, false); })).toThrow('changed');
	expect(owner.getStats().contentsValid).toBe(false); expect(f.publish).not.toHaveBeenCalled();
	owner.resize();
	expect(() => owner.compose(f.display, () => owner.dispose())).toThrow('changed');
	expect(owner.getStats().mode).toBe('disposed'); expect(f.publish).not.toHaveBeenCalled();
});

test.each(['backend', 'type', 'samples', 'depth', 'stencil', 'reversed', 'xr', 'mrt', 'output', 'callback',
	'clearDepth', 'clearStencil', 'scissor', 'viewport', 'viewport-depth', 'color', 'tone', 'exposure', 'empty'] as const)(
	'unsupported %s configuration declines before allocation or submission', kind => {
	const f = fixture();
	if (kind === 'backend') Object.assign(f.renderer.backend, { isWebGPUBackend: false });
	if (kind === 'type') f.renderer.getOutputBufferType = () => THREE.UnsignedByteType;
	if (kind === 'samples') Object.assign(f.renderer, { samples: 0 });
	if (kind === 'depth') f.renderer.depth = false;
	if (kind === 'stencil') f.renderer.stencil = true;
	if (kind === 'reversed') Object.assign(f.renderer, { reversedDepthBuffer: true });
	if (kind === 'xr') Object.assign(f.renderer.xr, { isPresenting: true });
	if (kind === 'mrt') f.renderer.setMRT({} as THREE.MRTNode);
	if (kind === 'output') f.renderer.setOutputRenderTarget({} as THREE.RenderTarget);
	if (kind === 'callback') f.renderer.setRenderObjectFunction(() => {});
	if (kind === 'clearDepth') f.renderer.setClearDepth(0.5);
	if (kind === 'clearStencil') f.renderer.setClearStencil(1);
	if (kind === 'scissor') f.ownCanvas.setScissorTest(true);
	if (kind === 'viewport') f.ownCanvas.setViewport(1, 0, 160, 120);
	if (kind === 'viewport-depth') f.ownCanvas.setViewport(0, 0, 160, 120, 0.2, 0.8);
	if (kind === 'color') f.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
	if (kind === 'tone') f.renderer.toneMapping = THREE.NoToneMapping;
	if (kind === 'exposure') f.renderer.toneMappingExposure = NaN;
	if (kind === 'empty') f.ownCanvas.setSize(0, 0, false);
	expect(f.create()).toBeUndefined(); expect(f.events).toEqual([]); expect(f.pipelineDispose).not.toHaveBeenCalled();
});

test('a foreign Canvas depth range and the borrowed target viewport survive success and exceptions', () => {
	const f = fixture(), owner = f.create()!, handle = owner.captureScratch()!;
	f.otherCanvas.setViewport(1, 2, 50, 40, 0.15, 0.85);
	Object.assign(handle.target.viewport, { minDepth: 0.25, maxDepth: 0.75 });
	const range = () => {
		let result: number[] = [];
		const out = new THREE.Vector4();
		out.copy = source => {
			const value = source as THREE.Vector4 & { minDepth: number; maxDepth: number };
			result = [value.minDepth, value.maxDepth]; return THREE.Vector4.prototype.copy.call(out, source);
		};
		f.otherCanvas.getViewport(out); return result;
	};
	for (const fail of [false, true]) {
		const draw = () => handle.borrow(() => {
			Object.assign(handle.target.viewport, { minDepth: 0, maxDepth: 1 });
			if (fail) throw Error('range failure');
		});
		if (fail) expect(draw).toThrow('range failure'); else expect(draw()).toBe(true);
		expect(range()).toEqual([0.15, 0.85]);
		expect(handle.target.viewport).toMatchObject({ minDepth: 0.25, maxDepth: 0.75 });
	}
});

test('a later unsupported profile permanently selects fallback and releases both owners once', () => {
	const f = fixture(), owner = f.create()!, handle = owner.captureScratch()!;
	const targetDispose = vi.spyOn(handle.target, 'dispose');
	f.renderer.toneMapping = THREE.NoToneMapping;
	expect(owner.compose(f.display, () => {})).toBe(false);
	expect(owner.getStats().mode).toBe('fallback'); expect(handle.isCurrent()).toBe(false);
	f.renderer.toneMapping = THREE.ACESFilmicToneMapping;
	expect(owner.clearTransparent()).toBe(false); expect(owner.resize()).toBe(false);
	owner.selectFallback(); owner.dispose(); owner.dispose();
	expect(targetDispose).toHaveBeenCalledOnce(); expect(f.pipelineDispose).toHaveBeenCalledOnce();
	expect(owner.getRenderTargets()).toEqual([]); expect(f.events).toEqual([]);
});

test('a replacement texture cannot silently disconnect the final output node from its attachment', () => {
	const f = fixture(), owner = f.create()!, target = owner.getRenderTargets()[0];
	const original = target.texture, replacement = original.clone();
	target.texture = replacement;
	expect(owner.compose(f.display, () => {})).toBe(false);
	expect(owner.getStats().mode).toBe('fallback'); expect(f.events).toEqual([]);
	original.dispose(); replacement.dispose();
});

test.each(['canvas', 'target'] as const)('external %s disposal cannot leave a usable output owner', kind => {
	const f = fixture(), owner = f.create()!, handle = owner.captureScratch()!;
	if (kind === 'canvas') f.ownCanvas.dispose(); else handle.target.dispose();
	expect(handle.isCurrent()).toBe(false); expect(owner.publish()).toBe(false); expect(owner.getRenderTargets()).toEqual([]);
	expect(f.pipelineDispose).toHaveBeenCalledOnce();
});
