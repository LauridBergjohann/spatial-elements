import { expect, test, vi } from 'vitest';
import { StageExperience } from './StageExperience.js';
import * as THREE from 'three/webgpu';

function fixture() {
	let finish!: () => void;
	const submitted = new Promise<void>(resolve => { finish = resolve; });
	const stage = Object.create(StageExperience.prototype);
	const presentation = { active: true, enterOpacity: 0, sharedOpacity: 0, exitOpacity: 0, geometryOpacity: 1 };
	const applied: number[] = [];
	Object.assign(stage, {
		disposed: false,
		pageBinding: { token: 3, isCurrent: (token: number) => token === stage.pageBinding.token },
		catalogPresentation: presentation,
		catalogBackgroundReveal: { value: 0 },
		presentation: { invalidateSceneEndpoints: vi.fn(), readiness: { entry: undefined } },
		syncPanelLayouts: vi.fn(),
		updatePanelPointerInteraction: vi.fn((delta: number) => {
			expect(delta).toBe(0);
			applied.push(stage.catalogPresentation.enterOpacity);
		}),
		pipeline: { setScrollRenderQuality: vi.fn(), warmRevealFrame: vi.fn(() => {
			expect(stage.catalogPresentation.sharedOpacity).toBe(stage.catalogPresentation.enterOpacity);
			return true;
		}) },
		renderer: { backend: { device: { queue: { onSubmittedWorkDone: vi.fn(() => {
			expect(stage.catalogPresentation).toBe(presentation);
			expect(stage.catalogBackgroundReveal.value).toBe(0);
			expect(applied.at(-1)).toBe(0);
			return submitted;
		}) } } } }
	});
	return { stage, presentation, applied, finish };
}

test('reveal warms fractional and endpoint owners and restores hidden state before its GPU fence', async () => {
	const { stage, presentation, applied, finish } = fixture();
	const result = stage.prepareStagedReveal();
	expect(applied).toEqual([0.5, 1, 0]);
	expect(stage.catalogPresentation).toBe(presentation);
	expect(stage.pipeline.warmRevealFrame).toHaveBeenCalledTimes(2);
	finish();
	await expect(result).resolves.toBe(true);
});

test.each(['abort', 'binding', 'dispose'])('reveal cannot resume after %s interrupts its GPU fence', async reason => {
	const { stage, finish } = fixture();
	const abort = new AbortController();
	const result = stage.prepareStagedReveal(abort.signal);
	if (reason === 'abort') abort.abort();
	if (reason === 'binding') stage.pageBinding.token++;
	if (reason === 'dispose') stage.disposed = true;
	finish();
	await expect(result).resolves.toBe(false);
});

test('a pre-aborted reveal does no work and a failed pass restores state before rejection', async () => {
	const { stage, presentation, applied } = fixture();
	const abort = new AbortController();
	abort.abort();
	await expect(stage.prepareStagedReveal(abort.signal)).resolves.toBe(false);
	expect(applied).toEqual([]);
	stage.pipeline.warmRevealFrame.mockImplementation(() => { throw new Error('GPU warm-up failed'); });
	await expect(stage.prepareStagedReveal()).rejects.toThrow('GPU warm-up failed');
	expect(stage.catalogPresentation).toBe(presentation);
	expect(stage.catalogBackgroundReveal.value).toBe(0);
	expect(applied).toEqual([0.5, 0]);
	expect(stage.renderer.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
	expect(stage.stagedRevealPreparing).toBeUndefined();
});

function cacheFixture() {
	const f = fixture(), target = new THREE.RenderTarget(300, 200);
	const ticket = { commit: vi.fn(() => true), cancel: vi.fn() };
	Object.assign(f.stage, { catalogHandoff: true, catalogMotionComplete: true, catalogDockTarget: false, detailMedia: 'minimap' });
	f.stage.renderer.backend.isWebGPUBackend = true;
	f.stage.renderer.getRenderTarget = () => target;
	f.stage.pipeline.withSceneCapture = (draw: () => unknown) => draw();
	f.stage.pipeline.isSceneCaptureCurrent = () => true;
	f.stage.presentation.prepareSceneEndpoints = vi.fn(() => {
		expect(f.stage.pipeline.warmRevealFrame).toHaveBeenCalledTimes(2);
		return ticket;
	});
	return { ...f, ticket };
}

test('scene endpoints are taken after all warm live writes and installed only after the GPU fence', async () => {
	const { stage, finish, ticket } = cacheFixture();
	const result = stage.prepareStagedReveal();
	expect(stage.presentation.prepareSceneEndpoints).toHaveBeenCalledTimes(1);
	expect(stage.stagedRevealPreparing).toBe(stage.stagedSceneCacheOwner);
	expect(ticket.commit).not.toHaveBeenCalled();
	finish(); await expect(result).resolves.toBe(true);
	expect(ticket.commit).toHaveBeenCalledTimes(1);
	expect(ticket.cancel).not.toHaveBeenCalled();
	expect(stage.stagedRevealPreparing).toBeUndefined();
});

test.each(['abort', 'binding', 'dispose', 'replacement'] as const)('a %s while fencing cancels the cache lease and cannot install pixels', async reason => {
	const { stage, finish, ticket } = cacheFixture(); const abort = new AbortController();
	const result = stage.prepareStagedReveal(abort.signal);
	if (reason === 'abort') abort.abort();
	if (reason === 'binding') stage.pageBinding.token++;
	if (reason === 'dispose') stage.disposed = true;
	if (reason === 'replacement') stage.stagedSceneCacheOwner = {};
	finish(); await expect(result).resolves.toBe(false);
	expect(ticket.commit).not.toHaveBeenCalled(); expect(ticket.cancel).toHaveBeenCalledTimes(1);
	expect(stage.stagedRevealPreparing).toBeUndefined();
});

test('a rejected GPU fence cancels the pending lease and releases the hidden clock hold', async () => {
	const { stage, ticket } = cacheFixture();
	stage.renderer.backend.device.queue.onSubmittedWorkDone.mockRejectedValue(new Error('device lost'));
	await expect(stage.prepareStagedReveal()).rejects.toThrow('device lost');
	expect(ticket.commit).not.toHaveBeenCalled(); expect(ticket.cancel).toHaveBeenCalledTimes(1);
	expect(stage.stagedRevealPreparing).toBeUndefined();
});

test('a stale pixel ticket keeps the prepared live fallback instead of retrying or rejecting navigation', async () => {
	const { stage, finish, ticket } = cacheFixture(); ticket.commit.mockReturnValue(false);
	const result = stage.prepareStagedReveal(); finish(); await expect(result).resolves.toBe(true);
	expect(stage.presentation.prepareSceneEndpoints).toHaveBeenCalledTimes(1);
	expect(stage.pipeline.warmRevealFrame).toHaveBeenCalledTimes(2);
});

test('the held List destination adopts already-ready asynchronous High before warming without waiting for optional work', async () => {
	const { stage, finish } = cacheFixture();
	stage.pageModelReady = true;
	stage.presentation.readiness.entry = { highState: 'ready' };
	stage.presentation.readiness.mode = 'asynchronous';
	stage.adoptPreparedHigh = vi.fn();
	const result = stage.prepareStagedReveal();
	expect(stage.adoptPreparedHigh).toHaveBeenCalledExactlyOnceWith();
	expect(stage.adoptPreparedHigh.mock.invocationCallOrder[0]).toBeLessThan(stage.pipeline.warmRevealFrame.mock.invocationCallOrder[0]);
	finish(); await expect(result).resolves.toBe(true);
});

test.each(['loading', 'failed', 'unavailable'])('the cache does not force %s High preparation', async highState => {
	const { stage, finish } = cacheFixture(); stage.pageModelReady = true;
	stage.presentation.readiness.entry = { highState }; stage.presentation.readiness.mode = 'asynchronous';
	stage.adoptPreparedHigh = vi.fn();
	const result = stage.prepareStagedReveal(); expect(stage.adoptPreparedHigh).not.toHaveBeenCalled();
	finish(); await expect(result).resolves.toBe(true);
});

test('missing bound render targets fail readiness without waiting on a queue', async () => {
	const { stage, applied } = fixture();
	stage.pipeline.warmRevealFrame.mockReturnValue(false);
	await expect(stage.prepareStagedReveal()).resolves.toBe(false);
	expect(applied).toEqual([0.5, 0]);
	expect(stage.renderer.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
});

test('reveal selects full quality before warming; pre-abort preserves the current scroll target', async () => {
	const { stage, finish } = fixture();
	const abort = new AbortController();
	abort.abort();
	await expect(stage.prepareStagedReveal(abort.signal)).resolves.toBe(false);
	expect(stage.pipeline.setScrollRenderQuality).not.toHaveBeenCalled();
	const result = stage.prepareStagedReveal();
	expect(stage.pipeline.setScrollRenderQuality).toHaveBeenCalledExactlyOnceWith(false);
	expect(stage.pipeline.setScrollRenderQuality.mock.invocationCallOrder[0])
		.toBeLessThan(stage.syncPanelLayouts.mock.invocationCallOrder[0]);
	expect(stage.syncPanelLayouts.mock.invocationCallOrder[0])
		.toBeLessThan(stage.pipeline.warmRevealFrame.mock.invocationCallOrder[0]);
	finish();
	await expect(result).resolves.toBe(true);
});
