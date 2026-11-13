import { expect, it } from 'vitest';
import { CatalogNavigationRegistry } from './CatalogNavigationRegistry.js';
import { resolveCatalogIntent } from './catalogRecipes.js';
import { resolveCatalogJourney } from './catalogJourney.js';

const url = (path: string) => new URL(path, 'https://example.test');
const identity = { brandId: 'collection identity', spatialElementId: 'tool:42' };

it('uses registered identities for arbitrary collection and detail paths, including query parameters', () => {
	const navigation = new CatalogNavigationRegistry();
	const source = url('/showcase/?filter=tools');
	const target = url('/stories/a-tool?edition=2');
	navigation.record(
		source,
		{ kind: 'content', brandId: identity.brandId, elements: [identity.spatialElementId] },
		[{ ...identity, href: target.href }]
	);
	expect(resolveCatalogIntent(source, target, 'link', navigation)).toMatchObject({
		identity,
		direction: 'list-to-detail'
	});
	navigation.record(target, { kind: 'detail', ...identity });
	expect(resolveCatalogIntent(target, source, 'popstate', navigation)).toMatchObject({
		identity,
		direction: 'detail-to-list',
		history: true
	});
	expect(
		resolveCatalogIntent(source, url('/stories/a-tool?edition=3'), 'link', navigation)
	).toBeUndefined();
});

it('allows a first visit to an arbitrary content page and confirms shared identities after registration', () => {
	const navigation = new CatalogNavigationRegistry();
	const source = url('/editorial'),
		target = url('/another/composition');
	navigation.record(source, { kind: 'content', brandId: identity.brandId, elements: ['tool:42'] });
	expect(resolveCatalogJourney(source, target, 'link', navigation)).toMatchObject({
		kind: 'content-view'
	});
	navigation.record(target, {
		kind: 'content',
		brandId: identity.brandId,
		elements: ['tool:42', 'other']
	});
	expect(resolveCatalogJourney(source, target, 'link', navigation)).toMatchObject({
		kind: 'content-view'
	});
	navigation.record(target, {
		kind: 'content',
		brandId: identity.brandId,
		elements: ['unrelated']
	});
	expect(resolveCatalogJourney(source, target, 'link', navigation)).toBeUndefined();
});

it('matches authored links before and after the router canonicalizes trailing slashes', () => {
	const navigation = new CatalogNavigationRegistry();
	const source = url('/showcase/'),
		target = url('/stories/a-tool/');
	navigation.record(
		source,
		{ kind: 'content', brandId: identity.brandId, elements: [identity.spatialElementId] },
		[{ ...identity, href: '/stories/a-tool' }]
	);
	expect(resolveCatalogIntent(source, target, 'link', navigation)).toMatchObject({
		identity,
		direction: 'list-to-detail'
	});
	navigation.record(target, { kind: 'detail', ...identity });
	expect(resolveCatalogIntent(target, url('/showcase'), 'popstate', navigation)).toMatchObject({
		identity,
		direction: 'detail-to-list'
	});
});

it('does not derive identity from a familiar URL or match across collection namespaces', () => {
	const navigation = new CatalogNavigationRegistry();
	const source = url('/demo/categories/list'),
		target = url('/demo/elements/column');
	expect(resolveCatalogIntent(source, target, 'link', navigation)).toBeUndefined();
	navigation.record(source, { kind: 'content', brandId: 'a', elements: ['column'] });
	navigation.record(target, { kind: 'detail', brandId: 'b', spatialElementId: 'column' });
	expect(resolveCatalogIntent(source, target, 'link', navigation)).toBeUndefined();
});

it('rejects external destinations, same-document anchors, ordinary pages and conflicting detail links', () => {
	const navigation = new CatalogNavigationRegistry();
	const source = url('/showcase/'),
		target = url('/conflict');
	navigation.record(
		source,
		{ kind: 'content', brandId: identity.brandId, elements: ['tool:42', 'other'] },
		[
			{ ...identity, href: target.href },
			{ ...identity, spatialElementId: 'other', href: target.href }
		]
	);
	expect(resolveCatalogJourney(source, target, 'link', navigation)).toBeUndefined();
	expect(resolveCatalogJourney(source, url('/showcase/#more'), 'link', navigation)).toBeUndefined();
	expect(
		resolveCatalogJourney(source, new URL('https://other.test/showcase/'), 'link', navigation)
	).toBeUndefined();
	navigation.record(target, { kind: 'ordinary' });
	expect(resolveCatalogJourney(source, target, 'link', navigation)).toBeUndefined();
});

it('snapshots authored elements and discards stale link advertisements without sharing stage state', () => {
	const navigation = new CatalogNavigationRegistry();
	const elements = [identity.spatialElementId];
	navigation.record(url('/one'), { kind: 'content', brandId: identity.brandId, elements }, [
		{ ...identity, href: '/detail' }
	]);
	elements.length = 0;
	expect(navigation.get(url('/one'))).toMatchObject({ elements: ['tool:42'] });
	expect(navigation.get(url('/detail'))).toMatchObject({ kind: 'detail' });
	navigation.record(url('/two'), { kind: 'ordinary' });
	expect(navigation.get(url('/detail'))).toBeUndefined();
	expect(new CatalogNavigationRegistry().get(url('/one'))).toBeUndefined();
});
