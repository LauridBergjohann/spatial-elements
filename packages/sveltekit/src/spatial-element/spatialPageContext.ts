import { getContext, onMount } from 'svelte';
import type { SpatialPage, SpatialPageRegistry } from '@spatial-elements/core/catalog/SpatialPageRegistry';

export const SPATIAL_PAGE = Symbol('spatial-page');

/** Register at mount: SSR renders the semantic page directly, GPU ownership starts in the browser. */
export function registerSpatialPage(read: () => SpatialPage) {
	const pages = getContext<SpatialPageRegistry | undefined>(SPATIAL_PAGE);
	if (!pages) throw new Error('Spatial pages must be rendered inside BrandStageShell or Stage.');
	onMount(() => pages.register(read));
}
