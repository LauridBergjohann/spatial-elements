import { afterEach, expect, test, vi } from 'vitest';
import { VirtualScrollController } from './VirtualScrollController.js';

vi.mock('./scrollFrame.js', () => ({
	STAGE_SCROLL_PRIORITY: { virtualDocument: -100 },
	getStageVisualScrollPosition: () => ({ scrollX: 0, scrollY: 0 }),
	subscribeStageScrollFrame: () => () => {},
	markStageScrollInput: vi.fn(),
	syncStageScrollToNative: vi.fn()
}));

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test.each(['mouse', 'touch', 'pen'])('pointer %s activation preserves document position; subsequent keyboard focus still reveals its target', async pointerType => {
	vi.useFakeTimers();
	const listeners = new Map<string, Set<EventListener>>();
	const add = (name: string, listener: EventListener) => {
		const group = listeners.get(name) ?? new Set(); group.add(listener); listeners.set(name, group);
	};
	const remove = (name: string, listener: EventListener) => listeners.get(name)?.delete(listener);
	const emit = (name: string, values: object) => {
		for (const listener of listeners.get(name) ?? []) listener({ ...values, type: name } as Event);
	};
	class MockElement {
		parent?: MockElement;
		style = { removeProperty() {}, setProperty() {}, transform: '', height: '' };
		classList = { add() {}, remove() {} };
		scrollHeight = 1600;
		addEventListener = add;
		removeEventListener = remove;
		contains(other: MockElement): boolean { return other === this || Boolean(other.parent && this.contains(other.parent)); }
		closest() { return null; }
		hasAttribute() { return false; }
		getBoundingClientRect() { return { top: 502.6, bottom: 976.05, left: 0, right: 439, width: 439, height: 473.45 }; }
	}
	const scrollTo = vi.fn();
	vi.stubGlobal('Element', MockElement); vi.stubGlobal('HTMLElement', MockElement);
	vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1)); vi.stubGlobal('cancelAnimationFrame', vi.fn());
	vi.stubGlobal('window', {
		innerWidth: 2456, innerHeight: 1000, scrollX: 0, scrollY: 0,
		location: { hash: '' }, addEventListener: add, removeEventListener: remove, scrollTo,
		getComputedStyle: () => ({ scrollMarginTop: '0' })
	});
	vi.stubGlobal('document', {});
	const container = new MockElement();
	const target = new MockElement(); target.parent = container;
	const child = new MockElement(); child.parent = target;
	const controller = new VirtualScrollController(container as unknown as HTMLElement,
		new MockElement() as unknown as HTMLElement, new MockElement() as unknown as HTMLElement);
	controller.start();

	emit('pointerdown', { target: child, pointerType });
	emit('focusin', { target }); // Native pointer focus.
	emit('click', { target: child });
	// A browser may run a microtask checkpoint between its native capture
	// listener and Svelte's delegated bubble listener.
	await Promise.resolve();
	emit('focusin', { target }); // Explicit focus from the Carousel click handler.
	expect(scrollTo).not.toHaveBeenCalled();
	vi.runAllTimers();
	emit('focusin', { target }); // The suppression expires with the click dispatch.
	expect(scrollTo).toHaveBeenCalledTimes(1);
	expect(scrollTo.mock.lastCall![0].top).toBeCloseTo(239.325, 3);
	expect(scrollTo.mock.lastCall![0].behavior).toBe('instant');
	scrollTo.mockClear();
	emit('pointerdown', { target: child, pointerType });
	emit('keydown', { key: 'Tab', target });
	emit('focusin', { target });
	expect(scrollTo).toHaveBeenCalledTimes(1);
	controller.destroy();
	expect([...listeners.values()].every(group => group.size === 0)).toBe(true);
});
