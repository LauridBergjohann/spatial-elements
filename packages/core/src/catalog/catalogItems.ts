import type { ProductOverviewItem } from '../product-detail/types.js';
export const CATALOG_ITEMS = Symbol('catalog-items');
export class CatalogItems {
	private entries = new Map<symbol, ProductOverviewItem>();
	constructor(private changed: (items: ProductOverviewItem[]) => void) {}
	register(item: ProductOverviewItem) {
		if ([...this.entries.values()].some((entry) => entry.occurrence === item.occurrence))
			throw new Error('Duplicate catalog occurrence: ' + item.occurrence);
		const token = Symbol();
		this.entries.set(token, item);
		this.publish();
		return () => {
			this.entries.delete(token);
			this.publish();
		};
	}
	private publish() {
		this.changed([...this.entries.values()]);
	}
}
