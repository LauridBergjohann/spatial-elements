import { expect, test, vi } from 'vitest';
import { StageExperience } from './StageExperience.js';
import { PreparationGate } from '../catalog/PreparationGate.js';

test('activity snapshot reports existing owners without rendering, warming or settling', () => {
	const stage = Object.create(StageExperience.prototype);
	const gate = new PreparationGate();
	gate.setPaused(true);
	const catalog = { camera: { pivotSettling: true, neutral: true } };
	Object.assign(stage, {
		lastFrameTime: 123, animationActive: true, catalogLayerAnimating: true,
		renderInvalidated: false, renderRequestId: 42, scrollActive: false,
		stagedAwaitingFirstFrame: false, catalogPresentation: { active: false },
		stagedPreparationIdle: 7, zoomPreparationFrame: 0, deferredZoomPreparation: false,
		preparationGate: gate, detailPreparationGate: new PreparationGate(),
		preparation: { current: { backgroundState: 'ready', highState: 'loading' } },
		assets: { getStats: () => ({ pendingLoads: 1, activeInstances: 5 }) },
		catalogLayer: { getRenderActivity: () => catalog },
		panels: { getRenderActivity: () => [] },
		requestRender: vi.fn(), renderFrame: vi.fn(), scheduleStagedPreparation: vi.fn()
	});
	const snapshot = stage.getVisualTestRenderActivity();
	expect(snapshot).toMatchObject({ lastFrameAt: 123, animationActive: true,
		catalogAnimating: true, pendingRenderFrame: true, renderInvalidated: false,
		preparation: { stagedIdlePending: true, gate: { paused: true, waiting: 0 },
			high: 'loading', assetLoads: 1 }, catalog });
	expect(stage.renderRequestId).toBe(42);
	expect(stage.animationActive).toBe(true);
	expect(stage.requestRender).not.toHaveBeenCalled();
	expect(stage.renderFrame).not.toHaveBeenCalled();
	expect(stage.scheduleStagedPreparation).not.toHaveBeenCalled();
});
