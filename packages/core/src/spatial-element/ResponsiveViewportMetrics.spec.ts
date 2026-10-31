import { afterEach, expect, it, vi } from 'vitest';
import { ResponsiveViewportMetrics } from './ResponsiveViewportMetrics.js';

afterEach(() => vi.unstubAllGlobals());

it('shares stable fit metrics, updates visible height separately and never measures on a frame read', () => {
	let stableHeight = 700;
	const probe = { style: { cssText: '' }, dataset: {}, setAttribute: vi.fn(), remove: vi.fn(),
		getBoundingClientRect: vi.fn(() => ({ height: stableHeight })) };
	const documentRect = vi.fn(() => ({ width: 1585 }));
	const listeners = new Map<string, () => void>();
	const windowMock = { innerWidth: 1600, innerHeight: 700,
		dispatchEvent: vi.fn(),
		addEventListener: vi.fn((name, listener) => listeners.set(name, listener)),
		removeEventListener: vi.fn((name) => listeners.delete(name)) };
	let pending: (() => void) | undefined;
	const disconnect = vi.fn();
	vi.stubGlobal('window', windowMock);
	vi.stubGlobal('document', { createElement: () => probe, documentElement: { getBoundingClientRect: documentRect } });
	vi.stubGlobal('getComputedStyle', () => ({ paddingTop: '20px', paddingRight: '0px', paddingBottom: '12px', paddingLeft: '0px' }));
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = disconnect; });
	vi.stubGlobal('requestAnimationFrame', (callback: () => void) => { pending = callback; return 1; });
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	const appendChild = vi.fn();
	const owner = new ResponsiveViewportMetrics({ appendChild } as unknown as HTMLElement);
	expect(owner.read()).toBeUndefined();
	owner.start(); owner.start();
	expect(appendChild).toHaveBeenCalledTimes(1);
	expect(owner.read()).toEqual({ width: 1600, height: 700, scrollbarWidth: 15,
		safeArea: { top: 20, right: 0, bottom: 12, left: 0 } });
	for (let frame = 0; frame < 60; frame++) { owner.read(); owner.read('visible'); }
	expect(probe.getBoundingClientRect).toHaveBeenCalledTimes(1);
	expect(documentRect).toHaveBeenCalledTimes(1);
	windowMock.innerHeight = 760;
	listeners.get('resize')!(); listeners.get('resize')!(); pending!();
	expect(windowMock.dispatchEvent).toHaveBeenCalledTimes(2);
	expect(owner.read()!.height).toBe(700);
	expect(owner.read('visible')!.height).toBe(760);
	expect(probe.getBoundingClientRect).toHaveBeenCalledTimes(2);
	stableHeight = 430;
	windowMock.innerWidth = 900;
	windowMock.innerHeight = 430;
	listeners.get('orientationchange')!(); pending!();
	expect(owner.read()!.height).toBe(430);
	expect(owner.read()!.width).toBe(900);
	owner.destroy();
	expect(listeners.size).toBe(0);
	expect(disconnect).toHaveBeenCalledOnce();
	expect(probe.remove).toHaveBeenCalledOnce();
	expect(owner.read()).toBeUndefined();
});
