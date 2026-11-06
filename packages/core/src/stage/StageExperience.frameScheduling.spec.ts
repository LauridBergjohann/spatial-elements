import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from './StageExperience.js';

afterEach(() => vi.unstubAllGlobals());

function fixture(active = true) {
	let next = 1;
	const pending = new Map<number, FrameRequestCallback>();
	vi.stubGlobal('document', { hidden: false });
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
		const id = next++; pending.set(id, callback); return id;
	});
	vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
	const stage = Object.create(StageExperience.prototype);
	Object.assign(stage, {
		disposed: false, stagedAwaitingFirstFrame: false, renderRequestId: 0,
		renderInvalidated: true, animationActive: false, catalogPresentation: { active },
		render: vi.fn(), renderFrame: vi.fn(() => {
			stage.renderInvalidated = false;
			// advancePreparedPage -> adoptHigh -> changed() is a production caller
			// that can invalidate synchronously inside the externally forced frame.
			stage.requestRender();
		})
	});
	return { stage, pending };
}

test('external flush consumes an inner RAF without losing its dirty state or drawing a stale pose', () => {
	const { stage, pending } = fixture();
	stage.requestRender(); // A previously queued ordinary frame is cancelled too.
	stage.flushCatalogFrame();
	expect(stage.renderFrame).toHaveBeenCalledExactlyOnceWith(true);
	expect(pending.size).toBe(0);
	expect(stage.renderRequestId).toBe(0);
	expect(stage.renderInvalidated).toBe(true);
	stage.flushCatalogFrame(); // The next externally supplied pose consumes the invalidation.
	expect(stage.renderFrame).toHaveBeenCalledTimes(2);
	expect(pending.size).toBe(0);
});

test('held binding and later asynchronous invalidation still schedule their own ordinary frame', () => {
	const { stage, pending } = fixture();
	stage.flushCatalogFrame();
	stage.requestRender();
	expect(pending.size).toBe(1);
	expect(pending.has(stage.renderRequestId)).toBe(true);
});

test('after the external clock ends, inner invalidation resumes exactly one ordinary frame', () => {
	const { stage, pending } = fixture(false);
	stage.flushCatalogFrame();
	expect(stage.renderFrame).toHaveBeenCalledOnce();
	expect(pending.size).toBe(1);
	expect(pending.has(stage.renderRequestId)).toBe(true);
});
