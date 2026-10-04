/** Package-owned interface copy. Product content remains part of SpatialElementData. */
export interface SpatialMessages {
	controls: {
		help: string;
		closeHelp: string;
	};
	interactionHelp: {
		title: string;
		rotate: string;
		zoom: string;
		pan: string;
		mouseRotate: string;
		mouseZoom: string;
		mousePan: string;
		touchRotate: string;
		touchZoom: string;
		touchPan: string;
		touchHint: string;
		touchScrollHint: string;
	};
}

/** Override individual strings; omitted groups/keys use the English defaults. */
export type SpatialMessagesInput = { [K in keyof SpatialMessages]?: Partial<SpatialMessages[K]> };

export const defaultSpatialMessages: Readonly<{
	[K in keyof SpatialMessages]: Readonly<SpatialMessages[K]>;
}> = Object.freeze({
	controls: Object.freeze({ help: '3D controls', closeHelp: 'Close help' }),
	interactionHelp: Object.freeze({
		title: 'Explore in 3D',
		rotate: 'Rotate',
		zoom: 'Zoom',
		pan: 'Pan',
		mouseRotate: 'Drag with the left mouse button',
		mouseZoom: 'Use the scroll wheel',
		mousePan: 'Drag with the right mouse button',
		touchRotate: 'Drag with one finger',
		touchZoom: 'Pinch with two fingers',
		touchPan: 'Drag with two fingers',
		touchHint: '3D · Drag with one finger to rotate',
		touchScrollHint: 'Touch outside the model to scroll the page.'
	})
});

export function resolveSpatialMessages(input: SpatialMessagesInput = {}): SpatialMessages {
	const merge = <T extends object>(defaults: T, overrides?: Partial<T>): T => {
		const result = { ...defaults };
		for (const key of Object.keys(defaults) as (keyof T)[]) {
			const value = overrides?.[key];
			if (typeof value === 'string') result[key] = value as T[keyof T];
		}
		return result;
	};
	return {
		controls: merge(defaultSpatialMessages.controls, input.controls),
		interactionHelp: merge(defaultSpatialMessages.interactionHelp, input.interactionHelp)
	};
}
