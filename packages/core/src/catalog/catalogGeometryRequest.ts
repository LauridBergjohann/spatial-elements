import type { CatalogEndpointAddress } from './CatalogEndpointRegistry.js';

/** Concrete source, resolved by the existing recipe/registry before capture. */
export type CatalogGeometryEndpoint = Omit<CatalogEndpointAddress, 'slot' | 'role'> & {
	slot: Exclude<CatalogEndpointAddress['slot'], 'detail.summary'>;
	role: 'geometry';
};

/** A retained capture can be retargeted before a concrete destination occurrence binds. */
export interface CatalogGeometryDestination {
	spatialElementId: string;
	kind: 'content' | 'hero' | 'dock';
}

export function geometryEndpoint(
	endpoint: Omit<CatalogEndpointAddress, 'role'>
): CatalogGeometryEndpoint {
	return {
		...endpoint,
		role: 'geometry',
		slot: endpoint.slot === 'detail.summary' ? 'detail.hero' : endpoint.slot
	};
}
