import { expect, it } from 'vitest';
import { CatalogNavigationRegistry } from './CatalogNavigationRegistry.js';
import { resolveCatalogIntent } from './catalogRecipes.js';
import { resolveCatalogJourney } from './catalogJourney.js';
const url = (path: string) => new URL(path, 'https://example.test');
it('keeps nested showcase collections and detail transitions in the same namespace', () => {
  const list = url('/showcase/tools/categories/list/');
  const detail = url('/showcase/tools/elements/joker/');
  const navigation = new CatalogNavigationRegistry();
  navigation.record(list, { kind: 'content', brandId: 'showcase/tools', elements: ['joker'] });
  navigation.record(detail, { kind: 'detail', brandId: 'showcase/tools', spatialElementId: 'joker' });
  expect(resolveCatalogIntent(list, detail, 'link', navigation)).toMatchObject({ identity: { brandId: 'showcase/tools', spatialElementId: 'joker' }, direction: 'list-to-detail' });
  expect(resolveCatalogIntent(detail, list, 'popstate', navigation)).toMatchObject({ direction: 'detail-to-list', history: true });
  expect(resolveCatalogJourney(list, url('/showcase/tools/categories/carousel/'), 'link', navigation)).toMatchObject({ kind: 'content-view', brandId: 'showcase/tools' });
  const foreign = url('/showcase/watches/elements/joker/');
  navigation.record(foreign, { kind: 'detail', brandId: 'watches', spatialElementId: 'joker' });
  expect(resolveCatalogIntent(list, foreign, 'link', navigation)).toBeUndefined();
  // A familiar-looking URL cannot invent an element registration.
  expect(resolveCatalogIntent(list, url('/tools/elements/joker/'), 'link', navigation)).toBeUndefined();
});
