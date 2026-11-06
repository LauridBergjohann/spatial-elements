import { afterEach, expect, test, vi } from 'vitest';
import { CatalogSpatialElementLayer } from './CatalogSpatialElementLayer.js';
import { focusCatalogLink } from './catalogActivationFocus.js';
import type { SpatialElementAssetManager } from './assets/SpatialElementAssetManager.js';

const disposers: (() => void)[] = [];
afterEach(() => {
	for (const dispose of disposers.splice(0)) dispose();
	vi.unstubAllGlobals();
});

function fixture() {
	const listeners = new Map<string, EventListener>();
	const frames = new Map<number, FrameRequestCallback>();
	let frameId = 0;
	vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
	vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
	vi.stubGlobal('window', {
		matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
		addEventListener: (type: string, listener: EventListener) => listeners.set(type, listener),
		removeEventListener: (type: string, listener: EventListener) => {
			if (listeners.get(type) === listener) listeners.delete(type);
		}
	});
	vi.stubGlobal('ResizeObserver', class {
		observe() {} unobserve() {} disconnect() {}
	});
	const invalidate = vi.fn();
	const layer = new CatalogSpatialElementLayer({} as SpatialElementAssetManager, invalidate);
	const state = layer as unknown as {
		actors: Map<string, unknown>;
		pointer: { active: boolean; pressed: boolean };
		transitionActive: boolean;
		readFocusVisible(target: HTMLElement): boolean;
	};
	let disposed = false;
	const dispose = () => {
		if (disposed) return;
		disposed = true;
		state.actors.clear();
		layer.dispose();
	};
	disposers.push(dispose);
	const dispatch = (type: string, values: Record<string, unknown> = {}) =>
		listeners.get(type)?.({ type, ...values } as unknown as Event);
	const actor = (carousel = true) => {
		const flags = { focused: false, hovered: false, front: true };
		const target = {
			href: 'https://example.test/demo/elements/column', target: '',
			ownerDocument: { URL: 'https://example.test/demo/categories/carousel', baseURI: 'https://example.test/', activeElement: null },
			getAttribute: () => null, closest: () => null, relList: { contains: () => false },
			focus: () => { flags.focused = true; dispatch('focusin', { target }); },
			matches: (selector: string) => selector === ':focus-visible' && flags.focused,
			hasAttribute: (name: string) => name === 'data-mouse-hover' && flags.hovered
		} as unknown as HTMLElement;
		state.actors.set(String(state.actors.size), carousel ? { pose: { read: () => ({ front: flags.front }) }, hitTarget: target } : { card: target });
		return { target, flags };
	};
	const frame = () => { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(16)); };
	const activate = (target: HTMLElement) => focusCatalogLink(target as HTMLAnchorElement, { button: 0 } as MouseEvent);
	return { layer, state, actor, dispatch, invalidate, dispose, listeners, frames, frame, activate };
}

test('unrelated focus and pointer-only focus do not schedule a source frame', () => {
	const f = fixture(), item = f.actor();
	f.dispatch('focusin', { target: {} });
	f.dispatch('focusout', { target: {} });
	f.dispatch('focusin', { target: item.target });
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).not.toHaveBeenCalled();
});

test.each([true, false])('keyboard focus and loss invalidate synchronously (carousel %s)', carousel => {
	const f = fixture(), item = f.actor(carousel);
	item.flags.focused = true;
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(1);
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(1);
	// The DOM no longer matches :focus-visible when focusout reaches the listener.
	item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(2);
});

test('focus sampled by a rendered actor survives the absence of its original focusin event', () => {
	const f = fixture(), item = f.actor();
	item.flags.focused = true;
	expect(f.state.readFocusVisible(item.target)).toBe(true);
	item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledOnce();
});

test('pointer highlight suppresses only equivalent carousel focus work and retains keyboard state', () => {
	const f = fixture(), item = f.actor();
	f.state.pointer.active = true;
	item.flags.hovered = item.flags.focused = true;
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).not.toHaveBeenCalled();
	// Once the pointer leaves, keyboard focus still has to be removable.
	f.dispatch('pointerleave');
	expect(f.invalidate).toHaveBeenCalledOnce();
	item.flags.hovered = item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(2);
});

test('press/release is idempotent without delaying a real release or losing pressed keyboard focus', () => {
	const f = fixture(), item = f.actor();
	f.dispatch('pointerup');
	expect(f.invalidate).not.toHaveBeenCalled();
	f.dispatch('pointerdown', { pointerType: 'mouse' });
	f.dispatch('pointerdown', { pointerType: 'mouse' });
	expect(f.invalidate).toHaveBeenCalledTimes(1);
	item.flags.focused = true;
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(1);
	f.dispatch('pointerup');
	expect(f.invalidate).toHaveBeenCalledTimes(2);
	expect(f.state.readFocusVisible(item.target)).toBe(true);
	f.dispatch('pointerup');
	f.dispatch('pointercancel');
	expect(f.invalidate).toHaveBeenCalledTimes(2);
});

test('list keyboard focus remains active while pressed, matching the list hover rule', () => {
	const f = fixture(), item = f.actor(false);
	f.dispatch('pointerdown', { pointerType: 'mouse' });
	item.flags.focused = true;
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(2);
});

test('transition-owned focus updates the remembered state without requesting an extra frame', () => {
	const f = fixture(), item = f.actor();
	f.state.transitionActive = true;
	item.flags.focused = true;
	f.dispatch('focusin', { target: item.target });
	expect(f.invalidate).not.toHaveBeenCalled();
	f.state.transitionActive = false;
	item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledOnce();
});

test('disposing removes the new focus listeners as well as the pointer listeners', () => {
	const f = fixture();
	expect(f.listeners.has('focusin')).toBe(true);
	f.dispose();
	expect(f.listeners.has('focusin')).toBe(false);
	expect(f.listeners.has('focusout')).toBe(false);
	expect(f.listeners.has('pointerdown')).toBe(false);
	expect(f.listeners.has('pointerup')).toBe(false);
});

test('only activation focus of the selected carousel batches its own request once', () => {
	const f = fixture(), item = f.actor();
	f.activate(item.target);
	f.activate(item.target); // The action and component both keep the native link focused.
	expect(item.flags.focused).toBe(true);
	expect(f.invalidate).not.toHaveBeenCalled();
	expect(f.frames.size).toBe(1);
	f.frame();
	expect(f.invalidate).toHaveBeenCalledOnce();
	expect(f.frames.size).toBe(0);
});

test.each(['list', 'neighbour'] as const)('%s activation focus retains its immediate request', kind => {
	const f = fixture(), item = f.actor(kind !== 'list');
	item.flags.front = false;
	f.activate(item.target);
	expect(f.invalidate).toHaveBeenCalledOnce();
	expect(f.frames.size).toBe(0);
});

test('Tab/hover/press and release remain immediate while activation focus is pending', () => {
	const f = fixture(), item = f.actor(), other = f.actor();
	f.activate(item.target);
	other.flags.focused = true;
	f.dispatch('focusin', { target: other.target });
	f.dispatch('pointermove', { pointerType: 'mouse', clientX: 10, clientY: 20 });
	f.dispatch('pointerdown', { pointerType: 'mouse' });
	f.dispatch('pointerup');
	expect(f.invalidate).toHaveBeenCalledTimes(4);
	f.frame();
	expect(f.invalidate).toHaveBeenCalledTimes(5);
});

test('navigation veto or absent router still receives the deferred focus request', () => {
	const f = fixture(), item = f.actor();
	f.activate(item.target);
	// No transition claims the source, irrespective of who prevented navigation.
	f.frame();
	expect(f.invalidate).toHaveBeenCalledOnce();
	item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(2);
});

test('transition takeover cancels only its activation request, including a stale callback', () => {
	const f = fixture(), item = f.actor();
	f.activate(item.target);
	const stale = [...f.frames.values()][0];
	f.layer.setExitOpacity(1, true);
	expect(f.invalidate).toHaveBeenCalledOnce();
	expect(f.frames.size).toBe(0);
	stale(16);
	expect(f.invalidate).toHaveBeenCalledOnce();
	f.layer.setExitOpacity(1, false);
	item.flags.focused = false;
	f.dispatch('focusout', { target: item.target });
	expect(f.invalidate).toHaveBeenCalledTimes(3);
});

test('destroy cancels pending activation focus without a stale request', () => {
	const f = fixture(), item = f.actor();
	f.activate(item.target);
	const stale = [...f.frames.values()][0];
	f.dispose();
	expect(f.frames.size).toBe(0);
	stale(16);
	expect(f.invalidate).not.toHaveBeenCalled();
});
