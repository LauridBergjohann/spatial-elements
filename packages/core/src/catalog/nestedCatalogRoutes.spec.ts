import { expect, it } from 'vitest';
import { resolveCatalogIntent } from './catalogRecipes.js';
import { resolveCatalogJourney } from './catalogJourney.js';
const url = (path: string) => new URL(path, 'https://example.test');
it('keeps nested showcase collections and detail transitions in the same namespace', () => {
  const list = url('/showcase/tools/categories/list/');
  const detail = url('/showcase/tools/elements/joker/');
  expect(resolveCatalogIntent(list, detail, 'link')).toMatchObject({ identity: { brandId: 'showcase/tools', spatialElementId: 'joker' }, direction: 'list-to-detail' });
  expect(resolveCatalogIntent(detail, list, 'popstate')).toMatchObject({ direction: 'detail-to-list', history: true });
  expect(resolveCatalogJourney(list, url('/showcase/tools/categories/carousel/'), 'link')).toMatchObject({ kind: 'content-view', brandId: 'showcase/tools' });
  expect(resolveCatalogIntent(list, url('/showcase/watches/elements/joker/'), 'link')).toBeUndefined();
  expect(resolveCatalogIntent(list, url('/tools/elements/joker/'), 'link')).toBeUndefined();
});
