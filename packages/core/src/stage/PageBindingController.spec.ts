import { afterEach, expect, test, vi } from 'vitest';
import { PageBindingController } from './PageBindingController.js';
import type { StagePanelTarget } from './stageTypes.js';

afterEach(() => vi.unstubAllGlobals());

test('invalidates queued resize callbacks before replacing hosts', () => {
	const callbacks: ResizeObserverCallback[] = [];
	const disconnect = vi.fn();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			constructor(callback: ResizeObserverCallback) {
				callbacks.push(callback);
			}
			observe() {}
			disconnect = disconnect;
		}
	);
	const frame = { dataset: { stagePanelBound: '' } } as unknown as HTMLElement;
	const owner = new PageBindingController();
	owner.attach([{ frame } as StagePanelTarget]);
	const first = owner.token;
	const notify = vi.fn();
	owner.observe(notify);
	callbacks[0]([], {} as ResizeObserver);
	expect(notify).toHaveBeenCalledTimes(1);
	owner.invalidate();
	owner.release();
	owner.attach([{ frame } as StagePanelTarget]);
	callbacks[0]([], {} as ResizeObserver);
	expect(notify).toHaveBeenCalledTimes(1);
	expect(owner.isCurrent(first)).toBe(false);
	expect(frame.dataset.stagePanelBound).toBeUndefined();
	expect(disconnect).toHaveBeenCalledTimes(1);
});

test('keeps document measurements separate from the current virtual scroll frame', () => {
	const owner = new PageBindingController();
	const rect = { fixed: false, left: 30, top: 500, width: 100, height: 60 };
	expect(owner.resolve(rect, 10, 200)).toEqual({
		left: 20,
		top: 300,
		right: 120,
		bottom: 360,
		width: 100,
		height: 60
	});
	expect(owner.resolve({ ...rect, fixed: true }, 10, 200).top).toBe(500);
	owner.viewportRect = rect;
	owner.setPanelRect({} as HTMLElement, rect);
	owner.invalidate();
	owner.release();
	expect(owner.viewportRect).toBeUndefined();
	expect(owner.panels).toEqual([]);
	expect(owner.viewport).toBeUndefined();
});
