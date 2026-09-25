import { expect, it } from 'vitest';
import { CatalogItems } from './catalogItems.js';
it('retains independent occurrences and releases only the owning registration', () => {
	let current: string[] = [];
	const items = new CatalogItems((values) => (current = values.map((v) => v.occurrence!)));
	const product = {
		id: 'same',
		href: '/product',
		title: 'Product',
		eyebrow: 'Brand',
		features: []
	};
	const first = items.register({ ...product, occurrence: 'first' });
	const second = items.register({ ...product, occurrence: 'second' });
	expect(current).toEqual(['first', 'second']);
	expect(() => items.register({ ...product, occurrence: 'second' })).toThrow('Duplicate');
	first();
	first();
	expect(current).toEqual(['second']);
	second();
	expect(current).toEqual([]);
});
