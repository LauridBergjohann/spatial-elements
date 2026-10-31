import { afterEach, expect, test, vi } from 'vitest';
import { StageExperience } from '../stage/StageExperience.js';

const releases: (() => void)[] = [];
afterEach(() => { releases.splice(0).forEach(release => release()); vi.unstubAllGlobals(); });

function fixture() {
	const request = vi.fn(() => 73), cancel = vi.fn();
	vi.stubGlobal('window', { innerWidth: 1440, innerHeight: 900 });
	vi.stubGlobal('document', { hidden: false });
	vi.stubGlobal('requestAnimationFrame', request); vi.stubGlobal('cancelAnimationFrame', cancel);
	const layer = {
		isStagedDetailReady: vi.fn(() => true), getStagedDetailTarget: vi.fn(() => ({})),
		capture: vi.fn(() => true), freezeStagedSource: vi.fn(), setHandoffTarget: vi.fn(),
		finishStagedPanel: vi.fn(), setDestinationSpatialElement: vi.fn(), finishHandoff: vi.fn()
	};
	const stage = Object.assign(Object.create(StageExperience.prototype), {
		catalogLayer: layer, renderer: { coordinateSystem: 2001 }, renderRequestId: 41,
		renderInvalidated: false, stagedAwaitingFirstFrame: false, render: vi.fn(),
		renderFrame: vi.fn(), deviceMotion: { update: vi.fn() },
		preparationGate: { setPaused: vi.fn() }, detailPreparationGate: { setPaused: vi.fn() },
		catalogPresentation: { active: true }, releaseSpatialCapture: vi.fn(),
		backgroundCanvas: { style: { removeProperty: vi.fn() } },
		presentation: { readiness: { mode: 'asynchronous' }, finishHandoff: vi.fn() }
	});
	const begin = () => {
		const result = stage.beginStagedDetailMotion({ spatialElementId: 'column' }, { x: 0, y: 0, width: 600, height: 600 });
		if (stage.releaseStagedSensorHold) releases.push(stage.releaseStagedSensorHold);
		return result;
	};
	return { stage, layer, request, cancel, begin };
}

test('prepared progress zero cancels the old Stage RAF and keeps invalidations for the first moved frame', () => {
	const f = fixture();
	expect(f.begin()).toBe(true);
	expect(f.cancel).toHaveBeenCalledWith(41);
	expect(f.stage.renderRequestId).toBe(0);
	f.stage.setStagedDetailProgress(0); f.stage.requestRender();
	expect(f.stage.renderInvalidated).toBe(true);
	expect(f.request).not.toHaveBeenCalled();
	expect(f.stage.renderFrame).not.toHaveBeenCalled();
	// A shared scroll callback must not submit the unchanged source either.
	StageExperience.prototype['renderFrame'].call(f.stage);
	expect(f.stage.renderInvalidated).toBe(true);
});

test.each([0.05, 1])('the first explicit flush submits progress %s, including reduced motion, and restores ordinary scheduling', progress => {
	const f = fixture(); f.begin();
	f.stage.setStagedDetailProgress(progress); f.stage.flushCatalogFrame();
	expect(f.stage.renderFrame).toHaveBeenCalledExactlyOnceWith(true);
	expect(f.stage.stagedAwaitingFirstFrame).toBe(false);
	f.stage.requestRender();
	expect(f.request).toHaveBeenCalledTimes(1);
});

test('cancelling before the first moved frame releases the pause and schedules the restored source', () => {
	const f = fixture(); f.begin();
	f.stage.finishCatalogGeometry();
	expect(f.stage.stagedAwaitingFirstFrame).toBe(false);
	expect(f.stage.stagedDetailTarget).toBeUndefined();
	expect(f.request).toHaveBeenCalledTimes(1);
	expect(f.stage.renderInvalidated).toBe(true);
});

test('an unprepared source leaves ordinary rendering and the existing RAF untouched', () => {
	const f = fixture(); f.layer.isStagedDetailReady.mockReturnValue(false);
	expect(f.begin()).toBe(false);
	expect(f.stage.stagedAwaitingFirstFrame).toBe(false);
	expect(f.stage.renderRequestId).toBe(41);
	expect(f.cancel).not.toHaveBeenCalled();
});
