import type { SpatialListItem, SpatialStageConfig } from '../spatial-element/types.js';

/** URL-derived view selection; scroll and transition progress live in separate controllers. */
export interface CatalogPage {
	brandId: string;
	/** `list` is retained as a legacy alias; content routes can contain several spatial sections. */
	view: 'content' | 'list' | 'detail';
	spatialElementId?: string;
	spatialElementStage?: SpatialStageConfig;
	spatialElements: SpatialListItem[];
}
