import { describe, expect, it, vi } from 'vitest';
import {
	CatalogEndpointRegistry,
	catalogEndpointKey,
	type CatalogEndpointAddress
} from './CatalogEndpointRegistry.js';

const address: CatalogEndpointAddress = {
	brandId: 'demo',
	productId: 'column',
	slot: 'pdp.summary',
	role: 'title'
};
const element = () => ({ isConnected: true }) as HTMLElement;

it('follows the recorded carousel occurrence from front to neighbour without choosing another product', () => {
	const registry = new CatalogEndpointRegistry();
	registry.restoreOrigin({ ...address, occurrence: 'ring/asv', slot: 'carousel.front' });
	registry.register(
		{ ...address, occurrence: 'ring/asv', slot: 'carousel.neighbour', role: 'container' },
		element()
	);
	expect(registry.getContentSlot(address)).toBe('carousel.neighbour');
	expect(
		registry.resolve({ ...address, slot: 'carousel.neighbour', role: 'title' })
	).toBeUndefined();
});

it('requires one visible carousel occurrence when no origin is known', () => {
	vi.stubGlobal('innerHeight', 900);
	vi.stubGlobal('innerWidth', 1440);
	try {
		const registry = new CatalogEndpointRegistry();
		const node = () =>
			({
				isConnected: true,
				getBoundingClientRect: () => ({
					width: 300,
					height: 300,
					top: 0,
					bottom: 300,
					left: 0,
					right: 300
				})
			}) as HTMLElement;
		registry.register(
			{ ...address, role: 'container', slot: 'carousel.front', occurrence: 'one' },
			node()
		);
		const release = registry.register(
			{ ...address, role: 'container', slot: 'carousel.front', occurrence: 'two' },
			node()
		);
		expect(registry.getContentSlot(address)).toBeUndefined();
		release();
		expect(registry.getContentSlot(address)).toBe('carousel.front');
	} finally {
		vi.unstubAllGlobals();
	}
});

it('does not replace a removed restored carousel with another occurrence', () => {
	const registry = new CatalogEndpointRegistry();
	registry.register(
		{ ...address, role: 'container', slot: 'carousel.front', occurrence: 'other' },
		element()
	);
	registry.restoreOrigin({ ...address, slot: 'carousel.front', occurrence: 'removed' });
	expect(registry.getContentSlot(address)).toBeUndefined();
});

it('reads current controller composition and rejects ambiguous or released owners', () => {
	const registry = new CatalogEndpointRegistry();
	let composition: 'hero' | 'dock' = 'hero';
	const release = registry.registerPresentation(address, () => composition);
	expect(registry.getComposition(address)).toBe('hero');
	composition = 'dock';
	expect(registry.getComposition(address)).toBe('dock');
	const newer = registry.registerPresentation(address, () => 'hero');
	expect(registry.getComposition(address)).toBe('unavailable');
	release();
	release();
	expect(registry.getComposition(address)).toBe('hero');
	newer();
	expect(registry.getComposition(address)).toBe('unavailable');
});

describe('explicit catalog endpoint registrations', () => {
	it('keeps brand, product, role and slot independent instead of selecting a DOM order', () => {
		const registry = new CatalogEndpointRegistry();
		const variants: CatalogEndpointAddress[] = [
			address,
			{ ...address, brandId: 'tools' },
			{ ...address, productId: 'orb' },
			{ ...address, role: 'eyebrow' },
			{ ...address, slot: 'pdp.dock' }
		];
		const nodes = variants.map(() => element());
		variants.forEach((key, i) => registry.register(key, nodes[i]));
		variants.forEach((key, i) => expect(registry.resolve(key)).toBe(nodes[i]));
		expect(catalogEndpointKey({ ...address, brandId: 'a:b', productId: 'c' })).not.toBe(
			catalogEndpointKey({ ...address, brandId: 'a', productId: 'b:c' })
		);
	});

	it('rejects a duplicate connected slot until its own registration is released', () => {
		const registry = new CatalogEndpointRegistry();
		const original = element();
		registry.register(address, original);
		const releaseDuplicate = registry.register(address, element());
		expect(registry.resolve(address)).toBeUndefined();
		releaseDuplicate();
		expect(registry.resolve(address)).toBe(original);
	});

	it('late and repeated cleanup cannot unregister a replacement', () => {
		const registry = new CatalogEndpointRegistry();
		const releaseOld = registry.register(address, element());
		releaseOld();
		const replacement = element();
		registry.register(address, replacement);
		const revision = registry.getSnapshot().registrationRevision;
		releaseOld();
		expect(registry.resolve(address)).toBe(replacement);
		expect(registry.getSnapshot().registrationRevision).toBe(revision);
	});

	it('ignores detached nodes without relying on mutable DOM attributes or portal parentage', () => {
		const registry = new CatalogEndpointRegistry();
		const node = element();
		registry.register(address, node);
		Object.assign(node, { isConnected: false });
		expect(registry.resolve(address)).toBeUndefined();
		Object.assign(node, { isConnected: true });
		expect(registry.resolve(address)).toBe(node);
	});

	it('copies identity and keeps stages isolated', () => {
		const registry = new CatalogEndpointRegistry();
		const other = new CatalogEndpointRegistry();
		const supplied = { ...address };
		const node = element();
		registry.register(supplied, node);
		supplied.productId = 'changed';
		expect(registry.resolve(address)).toBe(node);
		expect(other.resolve(address)).toBeUndefined();
		expect(registry.getSnapshot().entries[0].productId).toBe('column');
	});
});

it('resolves occurrence identity across roles and restores collision-safe history metadata', () => {
	const registry = new CatalogEndpointRegistry();
	const base: CatalogEndpointAddress = {
		...address,
		brandId: 'a:b',
		productId: 'c:d',
		slot: 'catalog.card'
	};
	const first = element(),
		second = element();
	registry.register({ ...base, occurrence: 'first' }, first);
	registry.register({ ...base, occurrence: 'second' }, second);
	registry.restoreFocus('catalog:' + JSON.stringify(['a:b', 'c:d', 'second']));
	expect(registry.resolve(base)).toBe(second);
	expect(registry.resolve({ ...base, occurrence: 'first' })).toBe(first);
	const release = registry.register({ ...base, occurrence: 'first' }, element());
	expect(registry.resolve({ ...base, occurrence: 'first' })).toBeUndefined();
	release();
	expect(registry.resolve({ ...base, occurrence: 'first' })).toBe(first);
});

it('does not substitute a different occurrence for an explicitly missing target', () => {
	const registry = new CatalogEndpointRegistry();
	const card: CatalogEndpointAddress = { ...address, slot: 'catalog.card', occurrence: 'one' };
	registry.register(card, element());
	expect(registry.resolve({ ...card, occurrence: 'two' })).toBeUndefined();
	expect(catalogEndpointKey(card)).not.toBe(catalogEndpointKey({ ...card, occurrence: 'two' }));
});

it('restores carousel activation independently from a same-product list occurrence', () => {
	const registry = new CatalogEndpointRegistry();
	const card = { ...element(), toggleAttribute() {} } as unknown as HTMLElement;
	const carousel = { ...element(), toggleAttribute() {} } as unknown as HTMLElement;
	registry.register(
		{ ...address, slot: 'catalog.card', role: 'container', occurrence: 'list' },
		card
	);
	registry.register(
		{ ...address, slot: 'carousel.front', role: 'container', occurrence: 'carousel' },
		carousel
	);
	registry.restoreFocus(
		'catalog:' + JSON.stringify(['demo', 'column', 'carousel', 'carousel.front'])
	);
	expect(registry.getContentSlot(address)).toBe('carousel.front');
	expect(registry.resolve({ ...address, slot: 'carousel.front', role: 'container' })).toBe(
		carousel
	);
	registry.prefer('demo', 'column', 'list');
	expect(registry.getContentSlot(address)).toBe('catalog.card');
});
