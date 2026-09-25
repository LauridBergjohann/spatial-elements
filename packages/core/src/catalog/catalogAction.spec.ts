import { expect, it } from 'vitest';
import { catalogActionSemantic } from './catalogAction.js';
it('shares explicit behavior or exact link destinations, never unspecified buttons', () => {
	expect(catalogActionSemantic({ label: 'Buy' })).toBeUndefined();
	expect(catalogActionSemantic({ label: 'Cart', semanticId: 'cart:add:column' })).toBe(
		'action:cart:add:column'
	);
	expect(catalogActionSemantic({ label: 'Buy', href: '/shop/a' })).not.toBe(
		catalogActionSemantic({ label: 'Buy', href: '/shop/b' })
	);
});
