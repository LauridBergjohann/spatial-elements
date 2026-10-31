import { afterEach, expect, test, vi } from 'vitest';
import { releaseSourceDomClipping } from './SourceDomClipping.js';

type Node = HTMLElement & { computed: Record<string, string>; writes: ReturnType<typeof vi.fn> };
function node(parent: Node | null = null, computed: Record<string, string> = {}) {
	const styles = new Map<string, { value: string; priority: string }>();
	const writes = vi.fn();
	const value = { parentElement: parent, scrollTop: 0, scrollLeft: 0,
		offsetWidth: 241, clientWidth: 239, offsetHeight: 100, clientHeight: 98,
		computed: { 'width': '240.5px', 'height': '100px', 'box-sizing': 'border-box',
			'overflow-x': 'visible', 'overflow-y': 'visible', 'clip-path': 'none', 'direction': 'ltr',
			'border-left-width': '1px', 'border-right-width': '1px', 'border-top-width': '1px', 'border-bottom-width': '1px',
			'padding-right': '6px', 'padding-bottom': '4px', ...computed }, writes,
		contains(other: Node) { for (let next: Node | null = other; next; next = next.parentElement as Node | null) if (next === value) return true; return false; },
		style: { getPropertyValue: (key: string) => styles.get(key)?.value ?? '',
			getPropertyPriority: (key: string) => styles.get(key)?.priority ?? '',
			setProperty: (key: string, val: string, priority = '') => { writes(key, val, priority); styles.set(key, { value: val, priority }); },
			removeProperty: (key: string) => { writes(key); styles.delete(key); } }
	} as unknown as Node;
	return value;
}
function install() {
	vi.stubGlobal('getComputedStyle', (element: Node) => ({
		overflowX: element.computed['overflow-x'], overflowY: element.computed['overflow-y'], clipPath: element.computed['clip-path'],
		boxSizing: element.computed['box-sizing'], direction: element.computed.direction,
		getPropertyValue: (name: string) => element.computed[name] ?? ''
	}));
}
afterEach(() => vi.unstubAllGlobals());

test('unclips shared ancestors once, preserves fractional boxes and scrollbar space, and restores author styles/priorities', () => {
	install();
	const root = node(null, { 'clip-path': 'inset(0)' }), query = node(root, { 'overflow-y': 'auto', 'overflow-x': 'hidden' });
	Object.assign(query, { clientWidth: 224 }); // 241 - 224 - two borders = 15px scrollbar.
	query.style.setProperty('overflow-y', 'auto', 'important');
	query.style.setProperty('padding-right', '6px'); query.writes.mockClear();
	const title = node(query), eyebrow = node(query), outside = node();
	const restore = releaseSourceDomClipping([title, eyebrow, outside], root)!;
	expect(query.style.getPropertyValue('overflow-y')).toBe('visible');
	expect(query.style.getPropertyValue('width')).toBe('240.5px');
	expect(query.style.getPropertyValue('padding-right')).toBe('21px');
	expect(root.style.getPropertyValue('clip-path')).toBe('none');
	expect(query.writes.mock.calls.filter(([property]) => property === 'overflow-y')).toHaveLength(1);
	expect(title.writes).not.toHaveBeenCalled(); expect(outside.writes).not.toHaveBeenCalled();
	restore(); const count = query.writes.mock.calls.length; restore();
	expect(query.writes).toHaveBeenCalledTimes(count);
	expect(query.style.getPropertyValue('overflow-y')).toBe('auto');
	expect(query.style.getPropertyPriority('overflow-y')).toBe('important');
	expect(query.style.getPropertyValue('padding-right')).toBe('6px');
	expect(query.style.getPropertyValue('width')).toBe('');
	expect(root.style.getPropertyValue('clip-path')).toBe('');
});

test('a scrolled clipping ancestor declines before any mutation rather than resetting its source scroll pose', () => {
	install(); const root = node(null, { 'clip-path': 'inset(0)' }), query = node(root, { 'overflow-y': 'auto' });
	query.scrollTop = 24;
	expect(releaseSourceDomClipping([node(query)], root)).toBeUndefined();
	expect(root.writes).not.toHaveBeenCalled(); expect(query.writes).not.toHaveBeenCalled();
});

test('unclipping never reveals additional hidden snippet content during the unchanged source frame', () => {
	install(); const root = node(), query = node(root, { 'overflow-y': 'auto' });
	Object.assign(query, { scrollHeight: 240 });
	expect(releaseSourceDomClipping([node(query)], root)).toBeUndefined();
	expect(query.writes).not.toHaveBeenCalled();
});

test('visible ancestors are untouched, while RTL and horizontal gutters keep their original content space', () => {
	install(); const root = node(), query = node(root, { 'overflow-x': 'scroll', 'direction': 'rtl', 'padding-left': '3px' });
	Object.assign(query, { clientWidth: 224, clientHeight: 83 });
	const restore = releaseSourceDomClipping([node(query)], root)!;
	expect(root.writes).not.toHaveBeenCalled();
	expect(query.style.getPropertyValue('padding-left')).toBe('18px');
	expect(query.style.getPropertyValue('padding-bottom')).toBe('19px');
	restore(); expect(query.style.getPropertyValue('padding-left')).toBe('');
});
