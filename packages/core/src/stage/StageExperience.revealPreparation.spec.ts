import { expect, test, vi } from 'vitest';
import { StageExperience } from './StageExperience.js';

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
		syncPanelLayouts: vi.fn(),
		updatePanelPointerInteraction: vi.fn((delta: number) => {
			expect(delta).toBe(0);
			applied.push(stage.catalogPresentation.enterOpacity);
		}),
		pipeline: { warmRevealFrame: vi.fn(() => {
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
});

test('missing bound render targets fail readiness without waiting on a queue', async () => {
	const { stage, applied } = fixture();
	stage.pipeline.warmRevealFrame.mockReturnValue(false);
	await expect(stage.prepareStagedReveal()).resolves.toBe(false);
	expect(applied).toEqual([0.5, 0]);
	expect(stage.renderer.backend.device.queue.onSubmittedWorkDone).not.toHaveBeenCalled();
});
