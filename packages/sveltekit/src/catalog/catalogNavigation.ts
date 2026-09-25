import { getContext } from 'svelte';
import { resolve } from '$app/paths';
import { navigating } from '$app/state';
import { preloadData } from '$app/navigation';
import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
import type { ProductOverviewItem } from '@spatial-elements/core/product-detail/types';
/** Kit integration boundary: authoring components use ordinary hrefs and product metadata. */
export function useCatalogNavigation() {
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const href = (value: string) => resolve(...([value] as unknown as Parameters<typeof resolve>));
	return {
		href,
		pending: () => navigating.to?.url,
		prepare(product: ProductOverviewItem) {
			void preloadData(href(product.href)).catch(() => {});
			if (product.stage) stage?.prefetchProduct?.(product.stage);
		}
	};
}
