import { getContext } from 'svelte';
import { resolve } from '$app/paths';
import { navigating } from '$app/state';
import { preloadData } from '$app/navigation';
import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
import type { SpatialListItem } from '@spatial-elements/core/spatial-element/types';
/** Kit integration boundary: authoring components use ordinary hrefs and element metadata. */
export function useCatalogNavigation() {
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const href = (value: string) => resolve(...([value] as unknown as Parameters<typeof resolve>));
	return {
		href,
		pending: () => navigating.to?.url,
		prepare(spatialElement: SpatialListItem) {
			void preloadData(href(spatialElement.href)).catch(() => {});
			if (spatialElement.stage) stage?.prefetchSpatialElement?.(spatialElement.stage);
		}
	};
}
