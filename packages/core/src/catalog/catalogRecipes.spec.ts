import { expect, it } from 'vitest';
import { resolveCatalogIntent, selectCatalogRecipe } from './catalogRecipes.js';
const url = (path: string) => new URL(path, 'https://catalog.example');
const list = url('/demo/categories/list?sort=title');
const hero = url('/demo/elements/column');

it('returns from partial docking with the hero and switches to the minimap only at the completed dock', () => {
	const intent = resolveCatalogIntent(hero, list, 'popstate');
	expect(selectCatalogRecipe(intent, 'intermediate', 'list')).toMatchObject({
		id: 'hero-to-list',
		source: 'detail.summary'
	});
	expect(selectCatalogRecipe(intent, 'dock', 'list')).toMatchObject({
		id: 'dock-to-list',
		source: 'detail.dock'
	});
	expect(selectCatalogRecipe(intent, 'unavailable', 'list')).toBeUndefined();
});

it('selects the existing forward recipe with explicit shared and geometry slots', () => {
	expect(
		selectCatalogRecipe(resolveCatalogIntent(list, hero, 'link'), 'list', 'hero')
	).toMatchObject({
		id: 'list-to-hero',
		source: 'catalog.card',
		targetShared: 'detail.summary',
		targetGeometry: 'detail.hero'
	});
});

it('distinguishes intent from a destination composition and does not enable unfinished edges', () => {
	const reverse = resolveCatalogIntent(hero, list, 'link');
	expect(reverse).toMatchObject({ direction: 'detail-to-list', target: 'list' });
	expect(selectCatalogRecipe(reverse, 'hero', 'list')).toMatchObject({
		id: 'hero-to-list',
		targetGeometry: 'catalog.card'
	});
	const section = resolveCatalogIntent(list, url('/demo/elements/column#merkmale'), 'link');
	expect(section?.target).toBe('section');
	expect(selectCatalogRecipe(section, 'list', 'dock')).toMatchObject({
		id: 'list-to-dock',
		targetGeometry: 'detail.dock'
	});
	const history = resolveCatalogIntent(list, hero, 'popstate');
	expect(history).toMatchObject({ history: true, target: 'restored' });
	expect(selectCatalogRecipe(history, 'list', 'hero')).toMatchObject({ id: 'list-to-hero' });
});

it('requires the actual supported compositions even for a normal spatialElement route', () => {
	const intent = resolveCatalogIntent(list, hero, 'link');
	expect(selectCatalogRecipe(intent, 'list', 'intermediate')).toMatchObject({ id: 'list-to-hero' });
	expect(selectCatalogRecipe(intent, 'list', 'unavailable')).toBeUndefined();
});

it('recognizes content resources without inferring their section composition from the URL', () => {
	for (const name of ['carousel', 'mixed']) {
		const content = url(`/demo/categories/${name}`);
		expect(resolveCatalogIntent(content, hero, 'link')?.identity.spatialElementId).toBe('column');
		expect(
			selectCatalogRecipe(resolveCatalogIntent(hero, content, 'popstate'), 'hero', 'list')?.id
		).toBe('hero-to-list');
	}
});

it('selects green only at the completed dock and keeps blue disabled', () => {
	const content = url('/demo/categories/mixed');
	const forward = resolveCatalogIntent(content, hero, 'link');
	const reverse = resolveCatalogIntent(hero, content, 'popstate');
	expect(selectCatalogRecipe(forward, 'carousel', 'hero')?.id).toBe('carousel-to-hero');
	expect(selectCatalogRecipe(reverse, 'intermediate', 'carousel')?.id).toBe('hero-to-carousel');
	expect(selectCatalogRecipe(forward, 'carousel', 'dock')?.id).toBe('carousel-to-dock');
	expect(selectCatalogRecipe(reverse, 'dock', 'carousel')?.id).toBe('dock-to-carousel');
	expect(selectCatalogRecipe(forward, 'list', 'carousel')).toBeUndefined();
});

it('rejects malformed, cross-brand/origin, carousel and spatial-element-to-spatial-element routes', () => {
	for (const target of [
		url('/tools/elements/column'),
		url('/demo/elements/%zz'),
		new URL('https://other.example/demo/elements/column'),
		url('/demo/categories/carousel')
	])
		expect(resolveCatalogIntent(list, target, 'link')).toBeUndefined();
	expect(resolveCatalogIntent(hero, url('/demo/elements/orb'), 'link')).toBeUndefined();
});

// Host product URLs remain valid while the public demo uses neutral element URLs.
it.each(['elements', 'products'])('supports %s detail URLs in both directions', (segment) => {
 const content = url('/demo/categories/carousel');
 const detail = url('/demo/' + segment + '/column#features');
 expect(resolveCatalogIntent(content, detail, 'link')).toMatchObject({
  identity: { brandId: 'demo', spatialElementId: 'column' }, direction: 'list-to-detail', target: 'section'
 });
 expect(resolveCatalogIntent(detail, content, 'popstate')).toMatchObject({
  identity: { brandId: 'demo', spatialElementId: 'column' }, direction: 'detail-to-list', history: true
 });
});
