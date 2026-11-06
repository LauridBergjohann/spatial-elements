import { expect, test, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { StageRenderPipeline, type StageRenderPorts } from './StageRenderPipeline.js';
import { DEFAULT_INTERACTION_THEME } from './stageConstants.js';

function fixture() {
	const canvas = new THREE.CanvasTarget({ width: 120, height: 80 } as HTMLCanvasElement);
	const calls: string[] = [];
	const renderer = {
		backend: { isWebGPUBackend: true }, xr: { isPresenting: false },
		stencil: false, reversedDepthBuffer: false,
		autoClear: false, autoClearColor: false, autoClearDepth: false, autoClearStencil: false,
		getClearDepth: () => 1, getClearStencil: () => 0,
		getOutputRenderTarget: () => null as THREE.RenderTarget | null,
		getMRT: () => null as object | null,
		setRenderTarget: vi.fn(), setCanvasTarget: vi.fn(), setClearColor: vi.fn(),
		clear: vi.fn(() => { calls.push('clear'); })
	};
	const render = vi.fn(() => { calls.push('draw'); });
	const pipeline = new StageRenderPipeline({ renderer, backgroundCanvasTarget: canvas,
		interactionTheme: () => DEFAULT_INTERACTION_THEME } as unknown as StageRenderPorts);
	Object.assign(pipeline, { _stageDisplayQuad: { render } });
	const flags = () => [renderer.autoClear, renderer.autoClearColor, renderer.autoClearDepth, renderer.autoClearStencil];
	return { renderer, canvas, pipeline, render, flags, calls };
}

test.each(Array.from({ length: 16 }, (_, mask) => mask))('StageDisplay clears in its draw and restores every caller flag combination (%i)', mask => {
	const f = fixture();
	[f.renderer.autoClear, f.renderer.autoClearColor, f.renderer.autoClearDepth, f.renderer.autoClearStencil] =
		[0, 1, 2, 3].map(bit => Boolean(mask & (1 << bit)));
	const before = f.flags();
	f.render.mockImplementation(() => {
		expect(f.flags()).toEqual([true, true, true, true]);
	});
	f.pipeline.renderStageDisplay();
	expect(f.renderer.clear).not.toHaveBeenCalled();
	expect(f.render).toHaveBeenCalledOnce();
	expect(f.flags()).toEqual(before);
	expect(f.renderer.setRenderTarget).toHaveBeenCalledWith(null);
	expect(f.renderer.setCanvasTarget).toHaveBeenCalledWith(f.canvas);
	expect(f.renderer.setClearColor).toHaveBeenCalledWith(0xffffff, 1);
});

test('StageDisplay restores all auto-clear flags if the fullscreen draw throws', () => {
	const f = fixture();
	f.renderer.autoClearDepth = true;
	const before = f.flags();
	f.render.mockImplementation(() => { throw new Error('display failed'); });
	expect(() => f.pipeline.renderStageDisplay()).toThrow('display failed');
	expect(f.flags()).toEqual(before);
	expect(f.renderer.clear).not.toHaveBeenCalled();
});

test.each([
	'fallback', 'xr', 'stencil', 'reverse-depth', 'clear-depth', 'clear-stencil',
	'output-target', 'mrt', 'scissor', 'viewport-offset', 'viewport-size', 'empty'
] as const)('StageDisplay retains clear then draw for the unproved %s configuration', mode => {
	const f = fixture();
	if (mode === 'fallback') f.renderer.backend.isWebGPUBackend = false;
	if (mode === 'xr') f.renderer.xr.isPresenting = true;
	if (mode === 'stencil') f.renderer.stencil = true;
	if (mode === 'reverse-depth') f.renderer.reversedDepthBuffer = true;
	if (mode === 'clear-depth') f.renderer.getClearDepth = () => 0.5;
	if (mode === 'clear-stencil') f.renderer.getClearStencil = () => 1;
	if (mode === 'output-target') f.renderer.getOutputRenderTarget = () => ({} as THREE.RenderTarget);
	if (mode === 'mrt') f.renderer.getMRT = () => ({});
	if (mode === 'scissor') f.canvas.setScissorTest(true);
	if (mode === 'viewport-offset') f.canvas.setViewport(1, 0, 120, 80);
	if (mode === 'viewport-size') f.canvas.setViewport(0, 0, 60, 80);
	if (mode === 'empty') f.canvas.setSize(0, 0, false);
	const before = f.flags();
	f.pipeline.renderStageDisplay();
	expect(f.calls).toEqual(['clear', 'draw']);
	expect(f.flags()).toEqual(before);
});

test('the full-viewport check compares logical units even with a fractional DPR', () => {
	const f = fixture();
	f.canvas.setPixelRatio(1.5);
	f.pipeline.renderStageDisplay();
	expect(f.renderer.clear).not.toHaveBeenCalled();
	expect(f.render).toHaveBeenCalledOnce();
});

test('an absent display does not touch the renderer', () => {
	const f = fixture();
	Object.assign(f.pipeline, { _stageDisplayQuad: undefined });
	f.pipeline.renderStageDisplay();
	expect(f.renderer.setCanvasTarget).not.toHaveBeenCalled();
	expect(f.render).not.toHaveBeenCalled();
});
