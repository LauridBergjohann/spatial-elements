import { afterEach, describe, expect, it, vi } from 'vitest';
import { prepareCatalogSummaryTransfer } from '../packages/sveltekit/src/catalog/catalogSummaryTransfer.js';
import type { CatalogEndpointRegistry } from '../packages/core/src/catalog/CatalogEndpointRegistry.js';
import type { SpatialSummaryHostController } from '../packages/sveltekit/src/spatial-element/spatialSummaryHost.svelte.js';

function style() {
	const values = new Map<string, [string, string]>();
	return { getPropertyValue: (name: string) => values.get(name)?.[0] ?? '',
		getPropertyPriority: (name: string) => values.get(name)?.[1] ?? '',
		setProperty: (name: string, value: string, priority = '') => values.set(name, [value, priority]),
		removeProperty: (name: string) => values.delete(name) };
}
function fixture(returning = false) {
	const child = { style: style() };
	const root = { style: style(), querySelectorAll: () => [child] };
	const slot = {} as HTMLElement;
	const surface = { querySelector: () => slot };
	const hold = { hidden: false, inert: false, dataset: {}, remove: vi.fn() };
	vi.stubGlobal('document', { createElement: () => hold, body: { append: vi.fn() } });
	const retained = { record: { kind: 'summary', root }, hold: vi.fn(), adopt: vi.fn(() => true),
		unfreeze: vi.fn(), restore: vi.fn(() => false), release: vi.fn() };
	const endpoints = { getContentSlot: () => 'carousel.front', getPreferredContentSlot: () => 'carousel.front',
		resolve: vi.fn((_address: { slot: string }) => surface) };
	const host = { retainByElement: vi.fn(() => retained) };
	const source = new URL('https://example.com/demo/categories/carousel');
	const target = new URL('https://example.com/demo/products/column');
	const prepare = () => prepareCatalogSummaryTransfer({ from: returning ? target : source, to: returning ? source : target,
		type: returning ? 'popstate' : 'link', endpoints: endpoints as unknown as CatalogEndpointRegistry,
		host: host as unknown as SpatialSummaryHostController });
	return { prepare, retained, endpoints, source, target, slot, root, child, hold };
}
afterEach(() => vi.unstubAllGlobals());

describe('ordinary catalog summary ownership', () => {
	it.each([false, true])('retains before route teardown and adopts before destination measurement (return=%s)', returning => {
		const f = fixture(returning), transfer = f.prepare()!;
		expect(f.retained.hold).not.toHaveBeenCalled();
		transfer.hold(); transfer.hold();
		expect(f.retained.hold).toHaveBeenCalledExactlyOnceWith(f.hold);
		expect(f.hold).toMatchObject({ hidden: true, inert: true });
		expect(transfer.adopt()).toBe(f.slot);
		expect(f.endpoints.resolve.mock.calls.map(([address]) => (address as { slot: string }).slot)).toEqual(
			returning ? ['detail.summary', 'carousel.front'] : ['carousel.front', 'detail.summary']);
		expect(f.retained.adopt).toHaveBeenCalledExactlyOnceWith(f.slot);
		expect(f.retained.unfreeze).toHaveBeenCalledOnce();
		transfer.cancel(); expect(transfer.adopt()).toBeUndefined();
		expect(f.retained.release).toHaveBeenCalledOnce();
		expect(f.hold.remove).toHaveBeenCalledOnce();
	});
	it('removes only temporary snapshot visibility while preserving authored priorities and other live styles', () => {
		const f = fixture();
		f.child.style.setProperty('visibility', 'visible', 'important');
		const transfer = f.prepare()!;
		f.root.style.setProperty('visibility', 'hidden', 'important');
		f.child.style.setProperty('visibility', 'hidden', 'important');
		f.child.style.setProperty('color', 'red');
		transfer.hold();
		expect(f.root.style.getPropertyValue('visibility')).toBe('');
		expect(f.child.style.getPropertyValue('visibility')).toBe('visible');
		expect(f.child.style.getPropertyPriority('visibility')).toBe('important');
		expect(f.child.style.getPropertyValue('color')).toBe('red');
	});
	it('restores a surviving source on cancellation without disposing its live owner', () => {
		const f = fixture(), transfer = f.prepare()!;
		f.retained.restore.mockReturnValue(true);
		transfer.hold(); transfer.cancel(); transfer.cancel();
		expect(f.retained.restore).toHaveBeenCalledOnce();
		expect(f.retained.release).not.toHaveBeenCalled();
		expect(f.retained.adopt).not.toHaveBeenCalled();
	});
	it('releases an orphaned source when a destination does not expose a summary', () => {
		const f = fixture(), transfer = f.prepare()!;
		f.endpoints.resolve.mockReturnValue(undefined as never);
		transfer.hold(); expect(transfer.adopt()).toBeUndefined();
		expect(f.retained.release).toHaveBeenCalledOnce();
		expect(f.retained.unfreeze).not.toHaveBeenCalled();
	});
	it('keeps the full detail summary when returning from a docked section', () => {
		const f = fixture(true); f.target.hash = '#reading';
		expect(f.prepare()).toBeDefined();
		expect(f.endpoints.resolve).toHaveBeenCalledWith(expect.objectContaining({ slot: 'detail.summary' }));
	});
	it('does not try to adopt a summary into a list card or another product', () => {
		const f = fixture(); f.endpoints.getContentSlot = () => 'catalog.card';
		expect(f.prepare()).toBeUndefined();
		f.source.pathname = '/demo/products/another';
		expect(f.prepare()).toBeUndefined();
		expect(f.retained.hold).not.toHaveBeenCalled();
	});
});
