import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	catalogSharedKey,
	CatalogTransition,
	CatalogTransitionSequence,
	resolveCatalogTransition
} from './CatalogTransition.js';

const url = (path: string) => new URL(path, 'https://catalog.example');
afterEach(() => vi.unstubAllGlobals());

function inlineStyle(changed: (property: string) => void = () => {}) {
	const values = new Map<string, string>();
	return {
		getPropertyValue: (property: string) => values.get(property) ?? '',
		getPropertyPriority: () => '',
		setProperty: vi.fn((property: string, value: string) => {
			values.set(property, value);
			changed(property);
		}),
		removeProperty: vi.fn((property: string) => values.delete(property))
	};
}

describe('catalog transition eligibility and identity', () => {
	it('selects a spatialElement across filtered lists without encoding layer or LOD in its identity', () => {
		const identity = resolveCatalogTransition(
			url('/demo/categories/list?sort=title'),
			url('/demo/elements/column'),
			'link'
		);
		expect(identity).toEqual({ brandId: 'demo', spatialElementId: 'column' });
		expect(catalogSharedKey(identity!, 'title')).toBe('["demo","column","title"]');
		expect(catalogSharedKey({ brandId: 'a:b', spatialElementId: 'c' }, 'title')).not.toBe(
			catalogSharedKey({ brandId: 'a', spatialElementId: 'b:c' }, 'title')
		);
	});

	it('leaves other edges, history, direct section targets and cross-brand visits to normal navigation', () => {
		const source = url('/demo/categories/list');
		expect(
			resolveCatalogTransition(source, url('/demo/elements/column#features'), 'link')
		).toBeUndefined();
		expect(
			resolveCatalogTransition(source, url('/demo/elements/column'), 'popstate')
		).toBeUndefined();
		expect(resolveCatalogTransition(source, url('/tools/elements/column'), 'link')).toBeUndefined();
		expect(
			resolveCatalogTransition(
				source,
				new URL('https://other.example/demo/elements/column'),
				'link'
			)
		).toBeUndefined();
		expect(
			resolveCatalogTransition(
				url('/demo/categories/carousel'),
				url('/demo/elements/column'),
				'link'
			)
		).toBeUndefined();
		expect(resolveCatalogTransition(url('/demo/elements/column'), source, 'link')).toBeUndefined();
		expect(resolveCatalogTransition(source, url('/demo/elements/%zz'), 'link')).toBeUndefined();
	});
});

describe('catalog transition ownership', () => {
	it('does not let an old completion settle or start a newer captured spatialElement transition', () => {
		const sequence = new CatalogTransitionSequence();
		const old = sequence.begin();
		expect(sequence.start(old)).toBe(true);
		const current = sequence.begin();
		expect(sequence.finish(old)).toBe(false);
		expect(sequence.start(old)).toBe(false);
		expect(sequence.phase).toBe('captured');
		expect(sequence.isCurrent(current)).toBe(true);
		expect(sequence.start(current)).toBe(true);
		expect(sequence.start(current)).toBe(false);
		expect(sequence.finish(current)).toBe(true);
		expect(sequence.active).toBe(false);
	});

	it('invalidates pending preparation when a nonanimated navigation or user interruption cancels it', () => {
		const sequence = new CatalogTransitionSequence();
		const captured = sequence.begin();
		sequence.cancel();
		expect(sequence.start(captured)).toBe(false);
		expect(sequence.finish(captured)).toBe(false);
		expect(sequence.phase).toBe('idle');
		const next = sequence.begin();
		expect(next).not.toBe(captured);
		expect(sequence.isCurrent(captured)).toBe(false);
		expect(sequence.isCurrent(next)).toBe(true);
	});
});

describe('catalog transition DOM work', () => {
	it('changes inherited presentation channels only when their values change', () => {
		const style = inlineStyle();
		const attributes = new Set<string>();
		const toggleAttribute = vi.fn((name: string, enabled: boolean) => {
			if (enabled) attributes.add(name);
			else attributes.delete(name);
		});
		const hooks = { setPresentation: vi.fn() };
		const transition = new CatalogTransition(
			{ style, toggleAttribute, hasAttribute: (name: string) => attributes.has(name) } as unknown as HTMLElement,
			{} as ConstructorParameters<typeof CatalogTransition>[1],
			hooks as ConstructorParameters<typeof CatalogTransition>[2]
		);
		const initial = { active: true, enterOpacity: 0, exitOpacity: 1, sharedOpacity: 0 };
		transition['setPresentation'](initial);
		transition['setPresentation'](initial);
		expect(style.setProperty).toHaveBeenCalledTimes(3);
		expect(toggleAttribute).toHaveBeenCalledTimes(2);
		transition['setPresentation']({ ...initial, enterOpacity: 0.5 });
		expect(style.setProperty).toHaveBeenCalledTimes(4);
		expect(style.getPropertyValue('--catalog-enter-opacity')).toBe('0.5');
		expect(attributes.has('data-catalog-enter-hidden')).toBe(false);
		transition['setPresentation']({ ...initial, active: false });
		transition['setPresentation']({ ...initial, active: false });
		expect(style.removeProperty).toHaveBeenCalledTimes(3);
		expect(attributes.size).toBe(0);
		// GPU presentation still receives every frame even when DOM opacity is unchanged.
		expect(hooks.setPresentation).toHaveBeenCalledTimes(5);
	});

	it('snapshots all outgoing computed styles before appending copies or hiding originals', () => {
		const activity: string[] = [];
		const attached: unknown[] = [];
		const createNode = (name: string) => ({
			name, parentElement: null, dataset: {} as Record<string, string>, attributes: [],
			style: inlineStyle(() => activity.push('write')),
			querySelectorAll: () => [], closest: () => null, matches: () => false,
			hasAttribute: () => false, setAttribute: vi.fn(), removeAttribute: vi.fn(),
			getBoundingClientRect: () => {
				activity.push('read');
				return { left: 10, top: 20, width: 200, height: 100, bottom: 120 };
			}
		});
		const clones = [createNode('first-copy'), createNode('second-copy')];
		// Detached clone writes do not invalidate live document style or layout.
		for (const clone of clones) clone.style = inlineStyle();
		const sources = ['first', 'second'].map((name, index) => ({
			...createNode(name), cloneNode: () => clones[index]
		}));
		vi.stubGlobal('window', { innerHeight: 900 });
		vi.stubGlobal('innerHeight', 900);
		vi.stubGlobal('getComputedStyle', (node: typeof sources[number]) => {
			activity.push('read');
			return Object.assign(['color', '--authored-detail'], {
				visibility: 'visible', display: 'block', opacity: '0.8',
				getPropertyValue: (property: string) => property === 'color' ? 'rgb(12, 34, 56)' : node.name
			});
		});
		vi.stubGlobal('document', {
			createDocumentFragment: () => ({
				children: [] as unknown[],
				appendChild(child: unknown) { this.children.push(child); }
			})
		});
		const transition = new CatalogTransition({
			querySelectorAll: () => sources,
			appendChild: (fragment: { children: unknown[] }) => {
				activity.push('write');
				attached.push(...fragment.children);
			}
		} as unknown as HTMLElement, {} as ConstructorParameters<typeof CatalogTransition>[1], {} as ConstructorParameters<typeof CatalogTransition>[2]);
		const capture = {
			recipe: { source: 'catalog.card' }, actors: [], exiting: [], restore: [] as (() => void)[]
		};
		transition['captureExitingContent'](capture as never);
		const firstWrite = activity.indexOf('write');
		expect(firstWrite).toBeGreaterThan(0);
		expect(activity.slice(firstWrite)).not.toContain('read');
		expect(attached).toEqual(clones);
		expect(clones.map((clone) => clone.style.getPropertyValue('--authored-detail'))).toEqual(['first', 'second']);
		expect(clones.map((clone) => clone.style.getPropertyValue('color'))).toEqual(['rgb(12, 34, 56)', 'rgb(12, 34, 56)']);
		expect(sources.map((source) => source.style.getPropertyValue('visibility'))).toEqual(['hidden', 'hidden']);
		for (const restore of capture.restore) restore();
		expect(sources.map((source) => source.style.getPropertyValue('visibility'))).toEqual(['', '']);
	});
});
