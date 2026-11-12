import { expect, it } from 'vitest';
import { CatalogNavigationRegistry } from './CatalogNavigationRegistry.js';
import {
	resolveCatalogJourney as resolveJourney,
	planCatalogParticipants,
	type CatalogParticipantEndpoint
} from './catalogJourney.js';
const url = (s: string) => new URL(s, 'https://catalog.example');
const navigation = new CatalogNavigationRegistry();
for (const path of ['/demo/categories/list', '/demo/categories/list?sort=title', '/demo/categories/carousel', '/demo/categories/mixed'])
 navigation.record(url(path), { kind: 'content', brandId: 'demo', elements: ['column'] });
for (const path of ['/demo/elements/column', '/demo/products/column', '/demo/elements/orb'])
 navigation.record(url(path), { kind: 'detail', brandId: 'demo', spatialElementId: path.endsWith('orb') ? 'orb' : 'column' });
navigation.record(url('/tools/elements/column'), { kind: 'detail', brandId: 'tools', spatialElementId: 'column' });
navigation.record(url('/tools/categories/carousel'), { kind: 'content', brandId: 'tools', elements: ['column'] });

const resolveCatalogJourney = (from: URL, to: URL, type: string) => resolveJourney(from, to, type, navigation);
const endpoint = (
	spatialElementId: string,
	overrides: Partial<CatalogParticipantEndpoint> = {}
): CatalogParticipantEndpoint => ({
	brandId: 'demo',
	spatialElementId,
	slot: 'catalog.card',
	role: 'geometry',
	sectionId: 'main',
	occurrence: spatialElementId,
	order: 0,
	eligible: true,
	prepared: true,
	...overrides
});

it('distinguishes content resources, spatialElement intent and ordinary document anchors', () => {
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
			url('/demo/elements/column#features'),
			'popstate'
		)
	).toMatchObject({ kind: 'spatialElement', intent: { history: true, target: 'restored' } });
	for (const destination of [
		'/demo/categories/list#modules',
		'/tools/categories/carousel',
		'https://other.example/arbitrary'
	])
		expect(
			resolveCatalogJourney(url('/demo/categories/list'), url(destination), 'link')
		).toBeUndefined();
});

it('requires explicit disambiguation and does not substitute removed requested spatialElements', () => {
	const a = endpoint('a'),
		other = endpoint('a', { sectionId: 'other', occurrence: 'other/a' });
	expect(planCatalogParticipants([a, other], [a])).toEqual([]);
	expect(planCatalogParticipants([a, other], [a], { sourceSection: 'main' })).toHaveLength(1);
	expect(planCatalogParticipants([a], [a], { spatialElementId: 'removed' })).toEqual([]);
	expect(planCatalogParticipants([a], [other], { targetSection: 'main' })).toEqual([]);
});

it('freezes a bounded prepared batch and prioritizes unique active selection', () => {
	const items = Array.from({ length: 20 }, (_, i) =>
		endpoint(String(i), { order: i, selected: i === 7 })
	);
	const pairs = planCatalogParticipants(items, items);
	expect(pairs).toHaveLength(5);
	expect(pairs[0].identity.spatialElementId).toBe('7');
	items[7].slot = 'carousel.neighbour';
	expect(pairs[0].source.slot).toBe('catalog.card');
	expect(planCatalogParticipants([endpoint('a', { prepared: false })], [endpoint('a')])).toEqual(
		[]
	);
	expect(planCatalogParticipants([endpoint('a')], [endpoint('b')])).toEqual([]);
	expect(planCatalogParticipants(items, items, {}, 0)).toEqual([]);
});
