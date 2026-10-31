import type { Snippet } from 'svelte';
import type { CatalogEndpointAddress, CatalogEndpointRole } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
import type { ResolvedSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';

export interface SpatialSummaryContext {
	spatialElement: Pick<ResolvedSpatialElementData, 'id' | 'brandId' | 'title' | 'eyebrow' | 'features' | 'action'>;
	mode: 'detail' | 'carousel';
	heading: 'h1' | 'h3';
	contentInset: number;
	address: (role: CatalogEndpointRole) => CatalogEndpointAddress | undefined;
}

/** Define this in the persistent brand layout. Initial output must be synchronous and content-only. */
export type SpatialSummarySnippet = Snippet<[SpatialSummaryContext]>;
