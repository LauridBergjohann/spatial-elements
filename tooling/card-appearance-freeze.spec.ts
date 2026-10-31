import { afterEach, expect, test, vi } from 'vitest';
import { freezeCardAppearance } from '../packages/sveltekit/src/spatial-element/cardAppearanceFreeze.js';

afterEach(() => vi.unstubAllGlobals());

function fixture() {
	let dirty = false;
	const lateReads: string[] = [];
	const element = (computed: Record<string, string>) => {
		const values = new Map<string, { value: string; priority: string }>();
		const attributes = new Map<string, string>();
		const node = { computed, values, attributes,
			style: {
				getPropertyValue: (name: string) => values.get(name)?.value ?? '',
				getPropertyPriority: (name: string) => values.get(name)?.priority ?? '',
				setProperty: vi.fn((name: string, value: string, priority = '') => { dirty = true; values.set(name, { value, priority }); }),
				removeProperty: vi.fn((name: string) => { dirty = true; values.delete(name); })
			},
			getAttribute: (name: string) => attributes.get(name) ?? null,
			setAttribute: vi.fn((name: string, value: string) => { dirty = true; attributes.set(name, value); }),
			removeAttribute: vi.fn((name: string) => { dirty = true; attributes.delete(name); })
		};
		return node;
	};
	const card = element({ 'outline-color': 'rgb(1, 2, 3)', 'outline-style': 'solid', 'outline-width': '3px', 'outline-offset': '5px' });
	const title = element({ transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,31.25,1)', 'text-shadow': 'rgba(0, 0, 0, .07) 0px 1.75px 4.375px' });
	const eyebrow = element({ transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,19.5,1)', 'text-shadow': title.computed['text-shadow'] });
	const surface = element(Object.fromEntries(['top', 'right', 'bottom', 'left'].map(edge => [`border-${edge}-color`, 'rgba(12, 34, 56, .42)'])));
	const poster = element({ transform: 'matrix3d(1.06,0,0,0,0,1.06,0,0,0,0,1,0,0,0,48,1)', opacity: '.37' });
	Object.assign(card, { querySelector: (selector: string) => selector.includes('surface') ? surface : poster,
		querySelectorAll: () => [title, eyebrow] });
	const all = [card, title, eyebrow, surface, poster];
	vi.stubGlobal('getComputedStyle', (node: typeof card, pseudo?: string) => {
		const read = (name: string) => {
			if (dirty) lateReads.push(name);
			return pseudo ? '.425' : node.computed[name] ?? '';
		};
		return { getPropertyValue: read, get opacity() { return read('opacity'); } };
	});
	return { card, title, eyebrow, surface, poster, all, lateReads,
		freeze: () => freezeCardAppearance(card as unknown as HTMLElement),
		resetDirty: () => { dirty = false; } };
}

test('reads all interpolated child and pseudo values before writes; does not pin hover or the root motion transform', () => {
	const f = fixture();
	f.card.attributes.set('data-mouse-hover', '');
	const restore = f.freeze();
	expect(f.lateReads).toEqual([]);
	for (const node of f.all) for (const [name, value] of Object.entries(node.computed)) {
		expect(node.style.getPropertyValue(name)).toBe(value);
		expect(node.style.getPropertyPriority(name)).toBe('important');
	}
	expect(f.surface.style.getPropertyValue('--spatial-card-frozen-after-opacity')).toBe('.425');
	expect(f.surface.attributes.has('data-spatial-card-appearance-frozen')).toBe(true);
	expect(f.card.style.getPropertyValue('transform')).toBe('');
	expect(f.card.style.getPropertyValue('transition-property')).toBe('');
	for (const node of f.all.slice(1)) expect(node.style.getPropertyValue('transition-property')).toBe('none');
	f.card.attributes.delete('data-mouse-hover');
	restore();
	expect(f.card.attributes.has('data-mouse-hover')).toBe(false);
	for (const node of f.all) expect(node.values.size).toBe(0);
});

test('restores exact inline priorities and transition longhands after Dock motion restores its own snapshot', () => {
	const f = fixture();
	f.title.style.setProperty('transform', 'translateZ(7px)', 'important');
	f.title.style.setProperty('transition-duration', '190ms', 'important');
	f.title.style.setProperty('transition-delay', '30ms');
	f.surface.style.setProperty('--spatial-card-frozen-after-opacity', '.1', 'important');
	f.surface.attributes.set('data-spatial-card-appearance-frozen', 'previous-owner');
	const originals = f.all.map(node => new Map(node.values));
	f.resetDirty();
	const restore = f.freeze();
	// Dock motion owns the title transform and transition shorthand until release.
	const frozenTransform = f.title.style.getPropertyValue('transform');
	f.title.style.setProperty('transform', 'matrix3d(moving)', 'important');
	f.title.style.removeProperty('transition-duration');
	f.title.style.removeProperty('transition-delay');
	f.title.style.setProperty('transform', frozenTransform, 'important');
	f.card.style.setProperty('opacity', '.4'); // belongs to another owner, never restored here
	restore();
	expect(f.title.values).toEqual(originals[1]);
	expect(f.surface.values).toEqual(originals[3]);
	expect(f.surface.attributes.get('data-spatial-card-appearance-frozen')).toBe('previous-owner');
	expect(f.card.style.getPropertyValue('opacity')).toBe('.4');
	const writes = f.all.map(node => node.style.setProperty.mock.calls.length + node.style.removeProperty.mock.calls.length);
	restore();
	expect(f.all.map(node => node.style.setProperty.mock.calls.length + node.style.removeProperty.mock.calls.length)).toEqual(writes);
});

test('missing optional eyebrow, poster or surface require neither fabricated nodes nor pseudo reads', () => {
	const f = fixture();
	Object.assign(f.card, { querySelector: () => null, querySelectorAll: () => [f.title] });
	const restore = f.freeze();
	expect(f.title.style.getPropertyValue('transform')).toBe(f.title.computed.transform);
	expect(f.surface.values.size).toBe(0);
	expect(f.poster.values.size).toBe(0);
	restore();
});

test('a failed style read leaves the source unchanged', () => {
	const f = fixture();
	vi.stubGlobal('getComputedStyle', () => { throw new Error('detached style'); });
	expect(f.freeze).toThrow('detached style');
	for (const node of f.all) {
		expect(node.values.size).toBe(0);
		expect(node.style.setProperty).not.toHaveBeenCalled();
	}
});

test('partial write failure releases every appearance claim', () => {
	const f = fixture();
	f.title.style.setProperty.mockImplementationOnce(() => { throw new Error('write failed'); });
	expect(f.freeze).toThrow('write failed');
	for (const node of f.all) expect(node.values.size).toBe(0);
	expect(f.surface.attributes.has('data-spatial-card-appearance-frozen')).toBe(false);
});
