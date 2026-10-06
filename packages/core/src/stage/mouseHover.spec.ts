import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mouseHover } from './mouseHover.js';

class Surface extends EventTarget {
	attributes = new Set<string>();
	setAttribute(name: string) { this.attributes.add(name); }
	removeAttribute(name: string) { this.attributes.delete(name); }
}

let root: EventTarget;
const cleanups: Array<() => void> = [];

beforeEach(() => {
	root = new EventTarget();
	vi.stubGlobal('window', root);
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.unstubAllGlobals();
});

function surface() {
	const node = new Surface();
	const action = mouseHover(node as unknown as HTMLElement);
	cleanups.push(action.destroy);
	return node;
}

function pointer(target: EventTarget, type: string, pointerType: string) {
	target.dispatchEvent(Object.assign(new Event(type), { pointerType }));
}

test('touch and pen never activate CSS hover, while a mouse can hover on the same device', () => {
	const node = surface();
	for (const pointerType of ['touch', 'pen']) {
		pointer(node, 'pointerenter', pointerType);
		pointer(node, 'pointermove', pointerType);
		expect(node.attributes.has('data-mouse-hover')).toBe(false);
	}
	pointer(node, 'pointerenter', 'mouse');
	expect(node.attributes.has('data-mouse-hover')).toBe(true);
	pointer(node, 'pointerleave', 'mouse');
	expect(node.attributes.has('data-mouse-hover')).toBe(false);
});

test('touching elsewhere clears stale hover and moving a real mouse restores it without re-entry', () => {
	const panel = surface();
	const nested = surface();
	for (const node of [panel, nested]) pointer(node, 'pointerenter', 'mouse');
	pointer(root, 'pointerdown', 'touch');
	expect(panel.attributes.has('data-mouse-hover')).toBe(false);
	expect(nested.attributes.has('data-mouse-hover')).toBe(false);
	pointer(panel, 'pointermove', 'mouse');
	expect(panel.attributes.has('data-mouse-hover')).toBe(true);
	pointer(root, 'pointermove', 'pen');
	expect(panel.attributes.has('data-mouse-hover')).toBe(false);
	pointer(panel, 'pointermove', 'mouse');
	root.dispatchEvent(new Event('blur'));
	expect(panel.attributes.has('data-mouse-hover')).toBe(false);
});

test('shares global listeners and releases them when the last surface is removed', () => {
	const add = vi.spyOn(root, 'addEventListener');
	const remove = vi.spyOn(root, 'removeEventListener');
	const first = surface();
	const second = surface();
	expect(add).toHaveBeenCalledTimes(3);
	pointer(first, 'pointerenter', 'mouse');
	cleanups.shift()!();
	expect(first.attributes.has('data-mouse-hover')).toBe(false);
	expect(remove).not.toHaveBeenCalled();
	pointer(second, 'pointerenter', 'mouse');
	pointer(root, 'pointerdown', 'touch');
	expect(second.attributes.has('data-mouse-hover')).toBe(false);
	cleanups.shift()!();
	expect(remove).toHaveBeenCalledTimes(3);
});
