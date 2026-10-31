import { afterEach, expect, test, vi } from 'vitest';
import { PageBindingController } from './PageBindingController.js';
import type { StagePanelTarget } from './stageTypes.js';
import { resolveMenuOffset, spatialLayoutTokens } from '../spatial-element/responsiveLayout.js';

afterEach(() => vi.unstubAllGlobals());

test.each([false, true])('shell DOM and panel coordinates share one scroll correction (fixed: %s)', (fixed) => {
	vi.stubGlobal('window', { getComputedStyle: () => ({ position: 'absolute', top: '16px' }) });
	const owner = new PageBindingController();
	// Re-measuring during a gesture must not cache the already compensated DOM position.
	for (const measuredAt of [0, 48, 112, 140, 300]) {
		const compensation = measuredAt + resolveMenuOffset(measuredAt, fixed);
		const shell = { dataset: { stageScrollCompensation: String(compensation) }, hasAttribute: () => fixed };
		const frame = {
			closest: (selector: string) => selector === '[data-stage-scroll-shell]' ? shell : null,
			getBoundingClientRect: () => ({ left: 136, top: 16 - measuredAt + compensation, width: 1328, height: 64 })
		} as unknown as HTMLElement;
		const cached = owner.measure(frame, 0, measuredAt);
		expect(cached.top).toBe(16);
		for (const scroll of [0, 48, 112, 140, 300, 140, 0]) {
			const nativeTop = fixed ? 16 : Math.min(16, 16 + spatialLayoutTokens.menu.scrollThreshold - scroll);
			expect(owner.resolve(cached, 0, scroll).top).toBe(nativeTop);
		}
	}
});

test('sticky panels stay below the header only until the end of their containing block', () => {
	vi.stubGlobal('window', { getComputedStyle: () => ({ position: 'sticky', top: '104px' }) });
	const frame = {
		getBoundingClientRect: () => ({ left: 900, top: 112, width: 494, height: 504 }),
		parentElement: { getBoundingClientRect: () => ({ bottom: 782 }) }
	} as unknown as HTMLElement;
	const owner = new PageBindingController();
	const measured = owner.measure(frame, 0, 0);
	expect(owner.resolve(measured, 0, 0).top).toBe(112);
	expect(owner.resolve(measured, 0, 100).top).toBe(104);
	expect(owner.resolve(measured, 0, 174).bottom).toBe(608);
	expect(owner.resolve(measured, 0, 300).bottom).toBe(482);
	expect(owner.resolve(measured, 0, 800).bottom).toBe(-18);
	expect(owner.resolve(measured, 0, 0).top).toBe(112);
});

test('native popover surfaces retain viewport coordinates when the document scrolls', () => {
	const popover = {} as HTMLElement;
	const frame = {
		closest: () => popover,
		getBoundingClientRect: () => ({ left: 120, top: 80, width: 300, height: 250 })
	} as unknown as HTMLElement;
	vi.stubGlobal('window', { getComputedStyle: (node: HTMLElement) => ({ position: node === popover ? 'fixed' : 'relative' }) });
	const owner = new PageBindingController();
	const measured = owner.measure(frame, 0, 400);
	expect(measured.fixed).toBe(true);
	expect(owner.resolve(measured, 0, 500)).toMatchObject({ left: 120, top: 80, width: 300, height: 250 });
});

test('fixed media descendants and their GPU rectangles share viewport coordinates across remeasurement', () => {
	vi.stubGlobal('window', { getComputedStyle: () => ({ position: 'relative', top: 'auto' }) });
	const region = {} as HTMLElement;
	const frame = {
		closest: (selector: string) => selector === '[data-stage-fixed-region]' ? region : null,
		getBoundingClientRect: () => ({ left: 178, top: 96, width: 1042, height: 788 })
	} as unknown as HTMLElement;
	const owner = new PageBindingController();
	for (const measuredAt of [0, 125.5, 900, 125.5, 0]) {
		const cached = owner.measure(frame, 0, measuredAt);
		expect(cached.fixed).toBe(true);
		for (const scroll of [0, 125.5, 900]) {
			expect(owner.resolve(cached, 0, scroll)).toEqual({
				left: 178, top: 96, right: 1220, bottom: 884, width: 1042, height: 788
			});
		}
	}
});

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
