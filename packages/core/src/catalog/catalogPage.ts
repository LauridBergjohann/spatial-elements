import type { SpatialListItem } from '../spatial-element/types.js';
import type { SpatialElementScene } from '../spatial-element/spatialElementScene.js';

/**
 * Low-level adapter binding; scroll and transition progress live in separate controllers.
 * SvelteKit page components derive this internally. Do not duplicate it in a BrandStageShell layout.
 */
export interface CatalogPage {
	brandId: string;
	/** `list` is retained as a legacy alias; content routes can contain several spatial sections. */
	view: 'content' | 'list' | 'detail';
	spatialElementId?: string;
	spatialElementStage?: SpatialElementScene;
	spatialElements: SpatialListItem[];
}
