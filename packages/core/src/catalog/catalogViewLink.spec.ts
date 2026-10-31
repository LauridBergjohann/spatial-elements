import { expect, test } from 'vitest';
import { readCatalogLinkContext } from './catalogViewLink.js';

const destination = new URL('https://example.test/demo/elements/orb#features');
function link(value: unknown, href = destination.href) {
	return { href, dataset: { catalogView: JSON.stringify(value) } } as unknown as HTMLAnchorElement;
}

test('only an explicit supported presentation is accepted from the activated matching link', () => {
	expect(readCatalogLinkContext(link({ spatialElementId: 'orb', targetPresentation: 'dock' }), destination))
		.toEqual({ spatialElementId: 'orb', targetPresentation: 'dock' });
	expect(readCatalogLinkContext(link({ targetPresentation: 'intermediate', targetSection: 'features' }), destination))
		.toEqual({ targetSection: 'features' });
	expect(readCatalogLinkContext(link({ targetPresentation: 'dock' }, 'https://example.test/elsewhere'), destination)).toEqual({});
	expect(readCatalogLinkContext(undefined, destination)).toEqual({});
});

test('malformed and unrelated author metadata cannot create a known endpoint', () => {
	const malformed = link({}); malformed.dataset.catalogView = '{';
	for (const anchor of [malformed, link(null), link([]), link({ targetPresentation: { kind: 'dock' } })])
		expect(readCatalogLinkContext(anchor, destination)).toEqual({});
});
