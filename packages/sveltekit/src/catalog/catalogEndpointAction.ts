import { getContext } from 'svelte';
import {
	CATALOG_ENDPOINTS,
	type CatalogEndpointAddress,
	type CatalogEndpointRegistry
} from '@spatial-elements/core/catalog/CatalogEndpointRegistry';

/** Create during component initialization; registration follows the actual element lifecycle. */
export function createCatalogEndpointAction() {
	const registry = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
	return (element: HTMLElement, address?: CatalogEndpointAddress) => {
		let release = address && registry?.register(address, element);
		return {
			update(next?: CatalogEndpointAddress) {
				release?.();
				release = next && registry?.register(next, element);
			},
			destroy() {
				release?.();
			}
		};
	};
}
