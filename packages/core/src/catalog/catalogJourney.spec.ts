import { expect, it } from 'vitest';
import {
	resolveCatalogJourney,
	planCatalogParticipants,
	type CatalogParticipantEndpoint
} from './catalogJourney.js';
const url = (s: string) => new URL(s, 'https://catalog.example');
const endpoint = (
	productId: string,
	overrides: Partial<CatalogParticipantEndpoint> = {}
): CatalogParticipantEndpoint => ({
	brandId: 'demo',
	productId,
	slot: 'catalog.card',
	role: 'geometry',
	sectionId: 'main',
	occurrence: productId,
	order: 0,
	eligible: true,
	prepared: true,
	...overrides
});

it('distinguishes content resources, product intent and ordinary document anchors', () => {
	expect(
		resolveCatalogJourney(
			url('/demo/categories/list'),
			url('/demo/categories/mixed#modules'),
			'link'
		)
	).toMatchObject({ kind: 'content-view', section: 'modules', history: false });
	expect(
		resolveCatalogJourney(
			url('/demo/categories/list'),
			url('/demo/products/column#features'),
			'popstate'
		)
	).toMatchObject({ kind: 'product', intent: { history: true, target: 'restored' } });
	for (const destination of [
		'/demo/categories/list#modules',
		'/tools/categories/carousel',
		'/%zz/categories/carousel'
	])
		expect(
			resolveCatalogJourney(url('/demo/categories/list'), url(destination), 'link')
		).toBeUndefined();
});

it('requires explicit disambiguation and does not substitute removed requested products', () => {
	const a = endpoint('a'),
		other = endpoint('a', { sectionId: 'other', occurrence: 'other/a' });
	expect(planCatalogParticipants([a, other], [a])).toEqual([]);
	expect(planCatalogParticipants([a, other], [a], { sourceSection: 'main' })).toHaveLength(1);
	expect(planCatalogParticipants([a], [a], { productId: 'removed' })).toEqual([]);
	expect(planCatalogParticipants([a], [other], { targetSection: 'main' })).toEqual([]);
});

it('freezes a bounded prepared batch and prioritizes unique active selection', () => {
	const items = Array.from({ length: 20 }, (_, i) =>
		endpoint(String(i), { order: i, selected: i === 7 })
	);
	const pairs = planCatalogParticipants(items, items);
	expect(pairs).toHaveLength(5);
	expect(pairs[0].identity.productId).toBe('7');
	items[7].slot = 'carousel.neighbour';
	expect(pairs[0].source.slot).toBe('catalog.card');
	expect(planCatalogParticipants([endpoint('a', { prepared: false })], [endpoint('a')])).toEqual(
		[]
	);
	expect(planCatalogParticipants([endpoint('a')], [endpoint('b')])).toEqual([]);
	expect(planCatalogParticipants(items, items, {}, 0)).toEqual([]);
});
