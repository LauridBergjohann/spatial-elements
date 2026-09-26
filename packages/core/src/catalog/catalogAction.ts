import type { SpatialElementAction } from '../spatial-element/types.js';

/** Unspecified buttons are not the same behavior merely because both lack an href. */
export function catalogActionSemantic(action: SpatialElementAction): string | undefined {
	return action.href
		? `link:${action.href}`
		: action.semanticId
			? `action:${action.semanticId}`
			: undefined;
}
