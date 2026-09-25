import { expect, it } from 'vitest';
import { resolveCatalogIntent, selectCatalogRecipe } from './catalogRecipes.js';
const url = (path: string) => new URL(path, 'https://catalog.example');
const list = url('/demo/categories/list?sort=title');
const hero = url('/demo/products/column');

it('returns from partial docking with the hero and switches to the minimap only at the completed dock', () => {
	const intent = resolveCatalogIntent(hero, list, 'popstate');
	expect(selectCatalogRecipe(intent, 'intermediate', 'list')).toMatchObject({
		id: 'hero-to-list',
		source: 'pdp.summary'
	});
	expect(selectCatalogRecipe(intent, 'dock', 'list')).toMatchObject({
		id: 'dock-to-list',
		source: 'pdp.dock'
	});
	expect(selectCatalogRecipe(intent, 'unavailable', 'list')).toBeUndefined();
});

it('selects the existing forward recipe with explicit shared and geometry slots', () => {
	expect(
		selectCatalogRecipe(resolveCatalogIntent(list, hero, 'link'), 'list', 'hero')
	).toMatchObject({
		id: 'list-to-hero',
		source: 'catalog.card',
		targetShared: 'pdp.summary',
		targetGeometry: 'pdp.hero'
	});
});

it('distinguishes intent from a destination composition and does not enable unfinished edges', () => {
	const reverse = resolveCatalogIntent(hero, list, 'link');
	expect(reverse).toMatchObject({ direction: 'detail-to-list', target: 'list' });
	expect(selectCatalogRecipe(reverse, 'hero', 'list')).toMatchObject({
		id: 'hero-to-list',
		targetGeometry: 'catalog.card'
	});
	const section = resolveCatalogIntent(list, url('/demo/products/column#merkmale'), 'link');
	expect(section?.target).toBe('section');
	expect(selectCatalogRecipe(section, 'list', 'dock')).toMatchObject({
		id: 'list-to-dock',
		targetGeometry: 'pdp.dock'
	});
	const history = resolveCatalogIntent(list, hero, 'popstate');
	expect(history).toMatchObject({ history: true, target: 'restored' });
	expect(selectCatalogRecipe(history, 'list', 'hero')).toMatchObject({ id: 'list-to-hero' });
});

it('requires the actual supported compositions even for a normal product route', () => {
	const intent = resolveCatalogIntent(list, hero, 'link');
	expect(selectCatalogRecipe(intent, 'list', 'intermediate')).toMatchObject({ id: 'list-to-hero' });
	expect(selectCatalogRecipe(intent, 'list', 'unavailable')).toBeUndefined();
});

it('recognizes content resources without inferring their section composition from the URL', () => {
	for (const name of ['carousel', 'mixed']) {
		const content = url(`/demo/categories/${name}`);
		expect(resolveCatalogIntent(content, hero, 'link')?.identity.productId).toBe('column');
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

it('rejects malformed, cross-brand/origin, carousel and product-to-product routes', () => {
	for (const target of [
		url('/tools/products/column'),
		url('/demo/products/%zz'),
		new URL('https://other.example/demo/products/column'),
		url('/demo/categories/carousel')
	])
		expect(resolveCatalogIntent(list, target, 'link')).toBeUndefined();
	expect(resolveCatalogIntent(hero, url('/demo/products/orb'), 'link')).toBeUndefined();
});
