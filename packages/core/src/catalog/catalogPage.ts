import type { ProductOverviewItem, ProductStageConfig } from '../product-detail/types.js';

/** URL-derived view selection; scroll and transition progress live in separate controllers. */
export interface CatalogPage {
	brandId: string;
	/** `list` is retained as a legacy alias; content routes can contain several spatial sections. */
	view: 'content' | 'list' | 'detail';
	productId?: string;
	productStage?: ProductStageConfig;
	products: ProductOverviewItem[];
}
