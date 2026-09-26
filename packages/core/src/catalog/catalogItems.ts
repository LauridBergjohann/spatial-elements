import type { SpatialListItem } from '../spatial-element/types.js';
export const CATALOG_ITEMS = Symbol('catalog-items');
export class CatalogItems {
	private entries = new Map<symbol, SpatialListItem>();
	constructor(private changed: (items: SpatialListItem[]) => void) {}
	register(item: SpatialListItem) {
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
