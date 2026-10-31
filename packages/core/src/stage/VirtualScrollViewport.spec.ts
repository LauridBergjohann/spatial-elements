import { afterEach, expect, test, vi } from 'vitest';
import { VirtualScrollController } from './VirtualScrollController.js';

vi.mock('./scrollFrame.js', () => ({
	STAGE_SCROLL_PRIORITY: { virtualDocument: -100, dock: 0, stage: 100 },
	getStageVisualScrollPosition: () => ({ scrollX: 0, scrollY: 400 }),
	subscribeStageScrollFrame: () => () => {},
	markStageScrollInput: vi.fn(), syncStageScrollToNative: vi.fn()
}));

afterEach(() => vi.unstubAllGlobals());

class TestElement {
	style = { transform: '', height: '', removeProperty() {} };
	classList = { add() {}, remove() {} };
	listeners = new Map<string, EventListener>();
	attributes = new Set<string>();
	children = new Map<string, TestElement>();
	region?: TestElement;
	fixed = false;
	scrollHeight = 2000;
	scrollPaddingTop = '0px';
	scrollPaddingBottom = '0px';
	scrollMarginTop = '0px';
	constructor(public top = 0, public height = 40) {}
	getBoundingClientRect() { return { top: this.top, bottom: this.top + this.height, left: 0, width: 100, height: this.height }; }
	closest(selector: string) {
		const selectors = selector.split(',').map((entry) => entry.trim());
		return selectors.includes('[data-stage-scroll-viewport]') ? this.region
			: selectors.includes('[data-stage-fixed-region]') && this.fixed ? this : null;
	}
	hasAttribute(name: string) { return this.attributes.has(name); }
	querySelector(selector: string) { return this.children.get(selector); }
	addEventListener(name: string, callback: EventListener) { this.listeners.set(name, callback); }
	removeEventListener(name: string) { this.listeners.delete(name); }
}

function fixture() {
	const scrollTo = vi.fn();
	vi.stubGlobal('HTMLElement', TestElement);
	vi.stubGlobal('CSS', { escape: (value: string) => value });
	vi.stubGlobal('document', {});
	vi.stubGlobal('window', {
		innerHeight: 900, scrollX: 0, scrollY: 400, location: { hash: '' },
		addEventListener() {}, removeEventListener() {},
		getComputedStyle: (node: TestElement) => node,
		matchMedia: () => ({ matches: false }), scrollTo
	});
	const container = new TestElement();
	const content = new TestElement(0, 2000);
	const controller = new VirtualScrollController(
		container as unknown as HTMLElement, content as unknown as HTMLElement,
		new TestElement() as unknown as HTMLElement
	);
	controller.start();
	const region = new TestElement();
	region.scrollPaddingTop = '182px';
	region.scrollPaddingBottom = '60px';
	return { controller, container, region, scrollTo };
}

test('a document fragment clears the pane header without creating a separate scroll position', () => {
	const { controller, container, region, scrollTo } = fixture();
	const target = new TestElement(500);
	target.region = region;
	target.scrollMarginTop = '12px';
	container.children.set('#reading', target);
	const token = {};
	controller.beginNavigation(token);
	controller.restoreTarget({ hash: '#reading' }, token);
	expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 706, behavior: 'instant' });
	target.attributes.add('data-stage-scroll-top');
	controller.restoreTarget({ hash: '#reading' }, token);
	expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 0, behavior: 'instant' });
	controller.destroy();
});

test('focus reveals body controls within the pane viewport while leaving fixed controls alone', () => {
	const { controller, container, region, scrollTo } = fixture();
	const target = new TestElement(300);
	target.region = region;
	const focus = () => container.listeners.get('focusin')!({ target } as unknown as Event);
	focus();
	expect(scrollTo).not.toHaveBeenCalled();
	// The control is inside the browser viewport, but hidden by the pane header.
	target.top = 170;
	focus();
	expect(scrollTo).toHaveBeenLastCalledWith({ top: 79, behavior: 'instant' });
	// The lower fixed submenu also obstructs a control before it leaves the browser.
	target.top = 805;
	focus();
	expect(scrollTo).toHaveBeenLastCalledWith({ top: 714, behavior: 'instant' });
	scrollTo.mockClear();
	target.fixed = true;
	focus();
	expect(scrollTo).not.toHaveBeenCalled();
	controller.destroy();
});

test('ordinary detail content retains the full-window anchor and focus rules', () => {
	const { controller, container, scrollTo } = fixture();
	const target = new TestElement(500);
	target.scrollMarginTop = '150px';
	container.children.set('#reading', target);
	const token = {};
	controller.beginNavigation(token);
	controller.restoreTarget({ hash: '#reading' }, token);
	expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, top: 750, behavior: 'instant' });
	controller.endNavigation(token);
	target.top = 880;
	container.listeners.get('focusin')!({ target } as unknown as Event);
	expect(scrollTo).toHaveBeenLastCalledWith({ top: 850, behavior: 'instant' });
	controller.destroy();
});
