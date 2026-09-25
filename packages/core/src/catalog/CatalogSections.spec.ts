import { expect, it } from 'vitest';
import { CatalogSections, type CatalogSectionSnapshot } from './CatalogSections.js';

it('restores independent section selections from the current entry before measurement', () => {
	const sections = new CatalogSections();
	let entry: CatalogSectionSnapshot = { selections: { first: 'a', second: 'b' } };
	sections.connect({ read: () => entry, write: (next) => (entry = next) });
	let first: string | undefined;
	let second: string | undefined;
	sections.register('first', { read: () => first, restore: (key) => (first = key) });
	sections.register('second', { read: () => second, restore: (key) => (second = key) });
	expect([first, second]).toEqual(['a', 'b']);
	first = 'c';
	sections.remember();
	expect(entry.selections).toEqual({ first: 'c', second: 'b' });
	entry = { selections: { first: 'a', second: 'd' } };
	sections.restore();
	expect([first, second]).toEqual(['a', 'd']);
});

it('releases only its own registration and rejects duplicate section IDs', () => {
	const sections = new CatalogSections();
	const host = { read: () => 'a', restore: () => {} };
	const release = sections.register('one', host);
	expect(() => sections.register('one', host)).toThrow('Duplicate');
	release();
	sections.register('one', host);
	release();
	expect(() => sections.register('one', host)).toThrow('Duplicate');
});
