/** Package-owned interface copy. Product content remains part of SpatialElementData. */
export interface SpatialMessages {
	controls: {
		help: string;
		closeHelp: string;
		detailView: string;
		fullscreen: string;
	};
	interactionHelp: {
		title: string;
		rotate: string;
		zoom: string;
		pan: string;
		mouseRotate: string;
		mouseZoom: string;
		mousePan: string;
		/** Plain text; {spacemouse} inserts the external SpaceMouse link. */
		mouseNavigationHint: string;
		spaceMousePermission: string;
		spaceMouseTitle: string;
		spaceMouseConnected: string;
		spaceMouseConnecting: string;
		spaceMouseReady: string;
		spaceMousePermissionTitle: string;
		spaceMouseUnavailableTitle: string;
		spaceMouseUnavailable: string;
		spaceMouseDiscover: string;
		spaceMouseClose: string;
		spaceMouseConfirm: string;
		spaceMouseDenied: string;
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
	controls: Object.freeze({ help: '3D controls', closeHelp: 'Close help', detailView: 'Detail view', fullscreen: 'Fullscreen' }),
	interactionHelp: Object.freeze({
		title: 'Explore in 3D',
		rotate: 'Rotate',
		zoom: 'Zoom',
		pan: 'Pan',
		mouseRotate: 'Drag with the left mouse button',
		mouseZoom: 'Use the scroll wheel',
		mousePan: 'Drag with the right mouse button',
		mouseNavigationHint: 'Alternatively, use a {spacemouse} to navigate.',
		spaceMousePermission: 'To use your SpaceMouse, allow this website to access the local 3Dconnexion driver. Select OK to try again and allow access when your browser asks.',
		spaceMouseTitle: 'click to connect spacemouse for 3d navigation',
		spaceMouseConnected: 'spacemouse is connected, click to disconnect',
		spaceMouseConnecting: "Connecting SpaceMouse",
		spaceMouseReady: "SpaceMouse connected. You can now navigate the model.",
		spaceMousePermissionTitle: "Allow SpaceMouse access",
		spaceMouseUnavailableTitle: "No SpaceMouse found",
		spaceMouseUnavailable: "No SpaceMouse connection could be established. Connect your device and check that the 3Dconnexion 3DxWare driver is installed and running.",
		spaceMouseDiscover: "Discover SpaceMouse at 3dconnexion.com",
		spaceMouseClose: "Close",
		spaceMouseConfirm: "OK",
		spaceMouseDenied: 'Access is blocked. Allow access to apps on this device in your browser’s site settings, then try again.',
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
