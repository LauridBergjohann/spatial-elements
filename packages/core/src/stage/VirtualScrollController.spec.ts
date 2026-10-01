import { afterEach, expect, test, vi } from 'vitest';
import { VirtualScrollController } from './VirtualScrollController.js';
import { SpatialElementDockController } from '../spatial-element/SpatialElementDockController.js';
import type { StageScrollFrame } from './scrollFrame.js';

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

test.each([{ width: 1400, dockTop: 0 }, { width: 900, dockTop: 16 }])(
	'docked minimap stays viewport-aligned at width $width without inherited scroll styles',
	({ width, dockTop }) => {
		vi.stubGlobal('window', {
			innerWidth: width, innerHeight: 900, scrollX: 0, scrollY: 0,
			location: { hash: '' }, matchMedia: () => ({ matches: false }),
			addEventListener() {}, removeEventListener() {}, dispatchEvent() {}
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
		root.children.set('[data-spatial-element-dock-minimap-anchor]', anchor);
		root.children.set('[data-spatial-element-sticky-header]', header);
		const virtual = new VirtualScrollController(
			container as unknown as HTMLElement,
			content as unknown as HTMLElement,
			spacer as unknown as HTMLElement
		);
		const dock = new SpatialElementDockController(root as unknown as HTMLElement);
		virtual.start();
		dock.start();

		for (const scrollY of [700, 1000.5, 800]) {
			for (const [callback] of [...subscriptions].sort((a, b) => a[1] - b[1])) {
				callback({ scrollX: 0, scrollY } as StageScrollFrame);
			}
			expect(content.style.transform).toBe(`translate3d(0px, ${-scrollY}px, 0)`);
			expect(Number.parseFloat(minimap.style.top) - scrollY).toBe(dockTop);
			expect(minimap.style.position).toBe('fixed');
			expect(content.style.setProperty).not.toHaveBeenCalled();
		}
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
	return {
		style, children, scrollHeight: rect.height, isConnected: true,
		classList: { add() {}, remove() {} },
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
