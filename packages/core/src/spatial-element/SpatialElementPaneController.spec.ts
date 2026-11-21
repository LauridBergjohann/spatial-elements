import { afterEach, expect, test, vi } from 'vitest';
import { SpatialElementPaneController, resolvePaneScrollClip, resolvePaneFocusPresentation } from './SpatialElementPaneController.js';
import { resolveDetailLayout, resolveZoomLayout } from './responsiveLayout.js';
import * as layouts from './responsiveLayout.js';
import * as scrollFrames from '../stage/scrollFrame.js';
import { getPanelFocusProgress } from '../stage/panelFocusMath.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('scroll and focus frames reuse pane geometry without rewriting unchanged styles, and resize invalidates it', () => {
	let scheduled: FrameRequestCallback | undefined;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { scheduled = callback; return 1; });
	vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('MutationObserver', class { observe() {} disconnect() {} });
	vi.stubGlobal('window', { scrollX: 0, scrollY: 0, addEventListener() {}, removeEventListener() {} });
	vi.spyOn(scrollFrames, 'getStageVisualScrollPosition').mockReturnValue({ scrollX: 0, scrollY: 0 });
	let onScroll: scrollFrames.StageScrollFrameCallback | undefined;
	vi.spyOn(scrollFrames, 'subscribeStageScrollFrame').mockImplementation(callback => { onScroll = callback; return () => {}; });
	const detailLayout = vi.spyOn(layouts, 'resolveDetailLayout');
	const zoomLayout = vi.spyOn(layouts, 'resolveZoomLayout');
	const writes = vi.fn();
	const style = () => {
		const values = new Map<string, string>();
		return { getPropertyValue: (name: string) => values.get(name) ?? '',
			setProperty: (name: string, value: string) => { writes(name, value); values.set(name, value); },
			removeProperty: (name: string) => { values.delete(name); },
			get clipPath() { return values.get('clip-path') ?? ''; },
			set clipPath(value: string) { writes('clip-path', value); values.set('clip-path', value); } };
	};
	const region = (kind: string) => ({ style: style(), inert: false,
		hasAttribute: (name: string) => name === kind, toggleAttribute() {}, removeAttribute() {} });
	const header = region('data-spatial-detail-pane-header');
	const submenu = region('data-spatial-detail-pane-submenu-shell');
	const body = { ...region('data-spatial-detail-pane-body'),
		getBoundingClientRect: () => ({ top: 0, height: 2000 }), querySelectorAll: () => [], querySelector: () => ({}) };
	let enhanced = false;
	const root = { style: style(), closest: () => ({ classList: { contains: () => enhanced } }),
		querySelector: () => body, querySelectorAll: (selector: string) => selector === '[data-spatial-detail-fixed]' ? [header, submenu] : [body, header, submenu],
		addEventListener() {}, removeEventListener() {}, toggleAttribute() {}, removeAttribute() {} };
	let metrics = { width: 2400, height: 900 };
	const readMetrics = vi.fn(() => metrics);
	const owner = new SpatialElementPaneController(root as unknown as HTMLElement, readMetrics, () => {});
	owner.start();
	scheduled?.(0); // Flush the native summary ownership pass.
	expect(detailLayout).toHaveBeenCalledTimes(1);
	expect(zoomLayout).toHaveBeenCalledTimes(1);
	readMetrics.mockClear();
	for (const focus of [0.2, 0.4, 0.6, 0.4, 0.2, 0]) {
		owner.setFocus(focus);
		writes.mockClear();
		owner.setFocus(focus);
		onScroll!({ scrollY: 0 } as scrollFrames.StageScrollFrame);
		expect(writes).not.toHaveBeenCalled();
	}
	expect(readMetrics).not.toHaveBeenCalled();
	expect(detailLayout).toHaveBeenCalledTimes(1);
	expect(zoomLayout).toHaveBeenCalledTimes(1);
	onScroll!({ scrollY: 100 } as scrollFrames.StageScrollFrame);
	expect(writes.mock.calls.map(([property]) => property)).toEqual(['--spatial-pane-focus-origin-y', 'clip-path']);
	// Enhanced scroll only compensates the fixed frames; inheriting a changing
	// value from root would invalidate all content styles on every wheel frame.
	enhanced = true;
	onScroll!({ scrollY: 180 } as scrollFrames.StageScrollFrame);
	expect(root.style.getPropertyValue('--spatial-pane-fixed-compensation')).toBe('');
	expect(body.style.getPropertyValue('--spatial-pane-fixed-compensation')).toBe('');
	expect(header.style.getPropertyValue('--spatial-pane-fixed-compensation')).toBe('180px');
	expect(submenu.style.getPropertyValue('--spatial-pane-fixed-compensation')).toBe('180px');

	metrics = { width: 2800, height: 1000 };
	// The already queued callback is also the same update used by resize/layout events.
	scheduled?.(0);
	expect(detailLayout).toHaveBeenCalledTimes(2);
	expect(zoomLayout).toHaveBeenCalledTimes(2);
	owner.setFocus(0.5);
	const expected = resolvePaneFocusPresentation(resolveDetailLayout(metrics).pane!.surface, metrics, 0.5);
	expect(root.style.getPropertyValue('--spatial-pane-focus-x')).toBe(`${expected.x}px`);
	expect(root.style.getPropertyValue('--spatial-pane-focus-y')).toBe(`${expected.y}px`);
	owner.destroy();
});

test.each([2300, 2456, 3128, 3440])('pane paint and native document coordinates agree at width %s', width => {
	const pane = resolveDetailLayout({ width, height: 900 }).pane!;
	const bodyHeight = 1800 + pane.body.y + 60;
	for (const scrollY of [0, 100, 500.5, bodyHeight - 900]) {
		const clip = resolvePaneScrollClip(0, bodyHeight, pane.body.y, pane.body.y + pane.body.height, scrollY);
		expect(clip.top - scrollY).toBe(182);
		expect(bodyHeight - clip.bottom - scrollY).toBe(862);
		expect(bodyHeight - clip.top - clip.bottom).toBe(pane.body.height);
	}
});

test('clip accounts for a nonzero document origin without applying scroll twice', () => {
	const clip = resolvePaneScrollClip(80, 2000, 182, 840, 400);
	// content at the upper and lower clip edges occupies the exact pane window.
	expect(80 + clip.top - 400).toBe(182);
	expect(80 + 2000 - clip.bottom - 400).toBe(840);
});

test.each([2300, 2456, 3440])('pane zoom leaves document layout intact and clears the right side at %s', width => {
	const viewport = { width, height: 900 };
	const pane = resolveDetailLayout(viewport).pane!.surface;
	const rest = resolvePaneFocusPresentation(pane, viewport, 0);
	expect(rest).toMatchObject({ x: 0, scale: 1, opacity: 1, blur: 0 });
	expect(Math.abs(rest.y)).toBe(0);
	const partial = resolvePaneFocusPresentation(pane, viewport, 0.5);
	const start = resolveDetailLayout(viewport).controls.viewSelector;
	const end = resolveZoomLayout(viewport).controls.viewSelector;
	expect(partial.x - pane.width * (partial.scale - 1) / 2).toBeCloseTo((end.x - start.x) * getPanelFocusProgress(0.5), 8);
	expect(partial.y - pane.height * (partial.scale - 1) / 2).toBeCloseTo((end.y - start.y) * getPanelFocusProgress(0.5), 8);
	expect(partial.x).toBeGreaterThan(0);
	expect(partial.scale).toBeGreaterThan(1);
	expect(partial.opacity).toBeGreaterThan(0);
	expect(partial.opacity).toBeLessThan(1);
	expect(partial.blur).toBeGreaterThan(0);
	expect(resolvePaneFocusPresentation(pane, viewport, 1).opacity).toBe(0);
	// The same viewport pivot must map the clipped body and fixed header edge
	// to one location, irrespective of the document's current scroll position.
	for (const scroll of [0, 200, 900]) {
		const bodyOrigin = partial.pivotY + scroll;
		const headerOrigin = partial.pivotY - pane.y;
		const bodyEdge = -scroll + bodyOrigin + partial.y + (pane.y + scroll - bodyOrigin) * partial.scale;
		const headerEdge = pane.y + headerOrigin + partial.y - headerOrigin * partial.scale;
		expect(bodyEdge).toBeCloseTo(headerEdge, 8);
	}
});
