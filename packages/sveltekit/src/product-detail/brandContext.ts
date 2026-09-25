import { getContext, setContext } from 'svelte';
import type { ProductBrandTheme } from '@spatial-elements/core/product-detail/types';

const PRODUCT_BRAND_CONTEXT = Symbol('product-brand');

/** Makes the current brand theme available to all product-detail descendants. */
export function provideProductBrand(getTheme: () => ProductBrandTheme) {
	setContext(PRODUCT_BRAND_CONTEXT, getTheme);
}

/** Returns the nearest brand theme or throws when the product shell is incomplete. */
export function useProductBrand() {
	const getTheme = getContext<(() => ProductBrandTheme) | undefined>(PRODUCT_BRAND_CONTEXT);
	if (!getTheme) {
		throw new Error('Product detail components must be rendered inside a brand layout');
	}
	return getTheme();
}
