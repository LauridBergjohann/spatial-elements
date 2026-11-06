import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogTransitionViewportChanged, readCatalogTransitionViewport } from './catalogTransitionViewport.js';

afterEach(() => vi.unstubAllGlobals());

describe('navigation viewport stability', () => {
	it('keeps the same transition space when Android browser chrome changes visible height', () => {
		const viewport = { innerWidth: 430, innerHeight: 740, devicePixelRatio: 3 };
		vi.stubGlobal('window', viewport);
		vi.stubGlobal('document', { querySelector: () => ({ getBoundingClientRect: () => ({ height: 740 }) }) });
		const before = readCatalogTransitionViewport();
		viewport.innerHeight = 820;
		expect(catalogTransitionViewportChanged(before, readCatalogTransitionViewport())).toBe(false);
	});
	it('cancels for rotation, a changed stable height, or changed rendering scale', () => {
		const before = { width: 430, height: 740, pixelRatio: 3 };
		expect(catalogTransitionViewportChanged(before, { ...before, width: 820, height: 350 })).toBe(true);
		expect(catalogTransitionViewportChanged(before, { ...before, height: 600 })).toBe(true);
		expect(catalogTransitionViewportChanged(before, { ...before, pixelRatio: 2 })).toBe(true);
	});
	it('retains ordinary height-resize cancellation without a stable layout probe', () => {
		const viewport = { innerWidth: 1440, innerHeight: 900, devicePixelRatio: 1 };
		vi.stubGlobal('window', viewport);
		vi.stubGlobal('document', { querySelector: () => null });
		const before = readCatalogTransitionViewport();
		viewport.innerHeight = 800;
		expect(catalogTransitionViewportChanged(before, readCatalogTransitionViewport())).toBe(true);
	});
});
