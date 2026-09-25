import type { ProductAction } from '../product-detail/types.js';

/** Unspecified buttons are not the same behavior merely because both lack an href. */
export function catalogActionSemantic(action: ProductAction): string | undefined {
	return action.href
		? `link:${action.href}`
		: action.semanticId
			? `action:${action.semanticId}`
			: undefined;
}
