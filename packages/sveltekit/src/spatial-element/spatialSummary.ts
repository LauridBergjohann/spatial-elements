import type { Snippet } from 'svelte';
import type { CatalogEndpointAddress, CatalogEndpointRole } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
import type { ResolvedSpatialElementData } from '@spatial-elements/core/spatial-element/spatialElement';
import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
import type { SpatialCardSize } from '@spatial-elements/core/spatial-element/responsiveLayout';

export interface SpatialSummaryContext {
	spatialElement: Pick<ResolvedSpatialElementData, 'id' | 'brandId' | 'title' | 'eyebrow' | 'features' | 'action'>;
	mode: 'detail' | 'carousel';
	heading: 'h1' | 'h3';
	contentInset: number;
	address: (role: CatalogEndpointRole) => CatalogEndpointAddress | undefined;
	/** Framework-owned carousel chrome travels with the live summary. */
	carousel?: { item: SpatialListItem; occurrence: string; compact: boolean };
}

/** Define this in the persistent brand layout. Initial output must be synchronous and content-only. */
export type SpatialSummarySnippet = Snippet<[SpatialSummaryContext]>;

/** Internal stable renderer input. Catalog membership remains owned by the route's placement. */
export interface SpatialCardContext {
	spatialElement: SpatialListItem;
	occurrence: string;
	order: number;
	cardSize: SpatialCardSize;
	textAlign: 'start' | 'center';
}

export type SpatialPresentationModel =
	| { kind: 'summary'; current: SpatialSummaryContext; active: boolean }
	| { kind: 'card'; current: SpatialCardContext; active: boolean };
