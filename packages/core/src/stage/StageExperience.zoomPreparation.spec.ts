import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from './StageExperience.js';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
	const frames: FrameRequestCallback[] = [];
	vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
	const prepare = vi.fn().mockResolvedValue(undefined);
	const stage = Object.create(StageExperience.prototype);
	Object.assign(stage, {
		deferredZoomPreparation: true, zoomPreparationFrame: 0, disposed: false,
		pageBinding: { token: 1, isCurrent: (token: number) => token === stage.pageBinding.token },
		catalogPresentation: { active: false }, pipeline: { prepareZoomEffects: prepare, warmRenderTargetSets: vi.fn() },
		requestRender: vi.fn()
	});
	return { stage, prepare, frame: () => frames.shift()!(0) };
}

test('optional zoom compilation starts only after the settled page has had a paint opportunity', async () => {
	const { stage, prepare, frame } = fixture();
	stage.scheduleZoomPreparation();
	stage.scheduleZoomPreparation();
	frame();
	expect(prepare).not.toHaveBeenCalled();
	frame();
	await Promise.resolve();
	expect(prepare).toHaveBeenCalledTimes(1);
	expect(stage.requestRender).toHaveBeenCalledTimes(1);
});

test.each(['navigation', 'page', 'dispose'])('queued warming does not run after %s supersedes it', (reason) => {
	const { stage, prepare, frame } = fixture();
	stage.scheduleZoomPreparation();
	frame();
	if (reason === 'navigation') stage.catalogPresentation.active = true;
	if (reason === 'page') stage.pageBinding.token++;
	if (reason === 'dispose') stage.disposed = true;
	frame();
	expect(prepare).not.toHaveBeenCalled();
});

test.each([true, false])('a completed reveal token uses the masked path only while valid (%s)', async valid => {
	const { stage, prepare, frame } = fixture();
	const token = {};
	stage.deferredScrollWarmup = token;
	stage.pipeline.warmInactiveScrollTargetSet = vi.fn(() => valid);
	stage.scheduleZoomPreparation(); frame(); frame(); await Promise.resolve();
	expect(stage.pipeline.warmInactiveScrollTargetSet).toHaveBeenCalledExactlyOnceWith(token);
	expect(stage.pipeline.warmRenderTargetSets).toHaveBeenCalledTimes(valid ? 0 : 1);
	expect(stage.deferredScrollWarmup).toBeUndefined();
	expect(prepare).toHaveBeenCalledOnce();
	expect(stage.requestRender).toHaveBeenCalledOnce();
});
