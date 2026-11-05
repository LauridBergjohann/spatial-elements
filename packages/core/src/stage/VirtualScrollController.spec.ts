import { afterEach, expect, test, vi } from 'vitest';
import { VirtualScrollController } from './VirtualScrollController.js';
import { SpatialElementDockController } from '../spatial-element/SpatialElementDockController.js';
import type { StageScrollFrame } from './scrollFrame.js';
import { STAGE_PANEL_LAYOUT_EVENT } from './panelContext.js';

const subscriptions = vi.hoisted(() => new Map<(frame: StageScrollFrame) => void, number>());
vi.mock('./scrollFrame.js', () => ({
	STAGE_SCROLL_PRIORITY: { virtualDocument: -100, dock: 0, stage: 100 },
	getStageVisualScrollPosition: () => ({ scrollX: 0, scrollY: 0 }),
	subscribeStageScrollFrame: (callback: (frame: StageScrollFrame) => void, priority: number) => {
		subscriptions.set(callback, priority);
		return () => subscriptions.delete(callback);
	},
	markStageScrollInput: vi.fn(),
	syncStageScrollToNative: vi.fn()
}));

afterEach(() => {
	subscriptions.clear();
	vi.unstubAllGlobals();
});

test.each([{ width: 1400, dockTop: 3 }, { width: 900, dockTop: 0 }]
	.flatMap(layout => [true, false].map(enhanced => ({ ...layout, enhanced }))))(
	'docked minimap stays viewport-aligned at width $width with enhanced scrolling $enhanced',
	({ width, dockTop, enhanced }) => {
		const events = new EventTarget();
		const frames = new Map<number, FrameRequestCallback>();
		let nextFrame = 0;
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
		vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
		vi.stubGlobal('window', {
			innerWidth: width, innerHeight: 900, scrollX: 0, scrollY: 0,
			location: { hash: '' }, matchMedia: () => ({ matches: false }),
			addEventListener: events.addEventListener.bind(events),
			removeEventListener: events.removeEventListener.bind(events),
			dispatchEvent: events.dispatchEvent.bind(events)
		});
		vi.stubGlobal('document', {});
		const container = element();
		const content = element({ left: 0, top: 0, width, height: 1600 });
		const spacer = element();
		const minimap = element({ left: 30, top: 600, width: 240, height: 180 });
		const anchor = element();
		anchor.children.set('[data-stage-panel-fallback]', minimap);
		const header = element({ left: 20, top: 20, width: width - 40, height: 100 });
		const root = element();
		Object.assign(root, { closest: () => container });
		root.children.set('[data-spatial-element-dock-minimap-anchor]', anchor);
		root.children.set('[data-spatial-element-sticky-header]', header);
		const virtual = new VirtualScrollController(
			container as unknown as HTMLElement,
			content as unknown as HTMLElement,
			spacer as unknown as HTMLElement
		);
		const dock = new SpatialElementDockController(root as unknown as HTMLElement);
		if (enhanced) virtual.start();
		dock.start();

		for (const scrollY of [700, 1000.5, 800]) {
			for (const [callback] of [...subscriptions].sort((a, b) => a[1] - b[1])) {
				callback({ scrollX: 0, scrollY } as StageScrollFrame);
			}
			if (enhanced) expect(content.style.transform).toBe(`translate3d(0px, ${-scrollY}px, 0)`);
			else expect(content.style.transform).toBeUndefined();
			expect(Number.parseFloat(minimap.style.top) - (enhanced ? scrollY : 0)).toBe(dockTop);
			expect(minimap.style.position).toBe('fixed');
			expect(minimap.getAttribute('data-stage-minimap-model-top')).toBe('0.000');
			expect(content.style.setProperty).not.toHaveBeenCalled();
		}
		expect(frames.size).toBe(0);
		window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
		expect(frames.size).toBe(1);
		for (const [id, callback] of [...frames]) { frames.delete(id); callback(0); }
		expect(frames.size).toBe(0);
		for (const [callback] of [...subscriptions].sort((a, b) => a[1] - b[1])) {
			callback({ scrollX: 0, scrollY: 100 } as StageScrollFrame);
		}
		expect(minimap.style.position).toBeUndefined();
		expect(minimap.style.top).toBeUndefined();
		dock.destroy();
		virtual.destroy();
		expect(subscriptions.size).toBe(0);
	}
);

function element(rect = { left: 0, top: 0, width: 100, height: 100 }) {
	const properties = new Map<string, string>();
	const attributes = new Map<string, string>();
	const style = {
		setProperty: vi.fn((key: string, value: string) => properties.set(key, value)),
		getPropertyValue: (key: string) => properties.get(key) ?? '',
		removeProperty: (key: string) => { properties.delete(key); Reflect.deleteProperty(style, key); }
	} as unknown as CSSStyleDeclaration;
	const children = new Map<string, unknown>();
	const classes = new Set<string>();
	return {
		style, children, scrollHeight: rect.height, isConnected: true,
		classList: { add(name: string) { classes.add(name); }, remove(name: string) { classes.delete(name); }, contains: (name: string) => classes.has(name) },
		closest: () => null,
		querySelector: (selector: string) => children.get(selector) ?? null,
		querySelectorAll: () => [],
		getBoundingClientRect: () => rect,
		addEventListener() {}, removeEventListener() {},
		getAttribute: (key: string) => attributes.get(key) ?? null,
		setAttribute: (key: string, value: string) => attributes.set(key, value),
		toggleAttribute() {},
		removeAttribute(key: string) {
			attributes.delete(key);
			if (key === 'style') {
				properties.clear();
				for (const key of Object.keys(style)) {
					if (typeof Reflect.get(style, key) !== 'function') Reflect.deleteProperty(style, key);
				}
			}
		}
	};
}
