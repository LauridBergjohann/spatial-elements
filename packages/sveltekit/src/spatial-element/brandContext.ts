import { getContext, setContext } from 'svelte';
import type { SpatialTheme } from '@spatial-elements/core/spatial-element/types';

const SPATIAL_ELEMENT_BRAND_CONTEXT = Symbol('spatial-element-brand');

/** Makes the current brand theme available to all spatial-element descendants. */
export function provideSpatialTheme(getTheme: () => SpatialTheme) {
	setContext(SPATIAL_ELEMENT_BRAND_CONTEXT, getTheme);
}

/** Returns the nearest brand theme or throws when the element shell is incomplete. */
export function useSpatialTheme() {
	const getTheme = getContext<(() => SpatialTheme) | undefined>(SPATIAL_ELEMENT_BRAND_CONTEXT);
	if (!getTheme) {
		throw new Error('SpatialElement detail components must be rendered inside a brand layout');
	}
	return getTheme();
}
