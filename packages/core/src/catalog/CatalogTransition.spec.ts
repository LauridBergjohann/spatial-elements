import { describe, expect, it } from 'vitest';
import {
	catalogSharedKey,
	CatalogTransitionSequence,
	resolveCatalogTransition
} from './CatalogTransition.js';

const url = (path: string) => new URL(path, 'https://catalog.example');

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
