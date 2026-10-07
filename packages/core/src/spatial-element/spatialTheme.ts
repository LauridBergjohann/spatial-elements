import type { SpatialTheme } from './types.js';

/** Input for createSpatialTheme. Every appearance group merges with the library defaults. */
export type SpatialThemeOptions = Pick<SpatialTheme, 'id' | 'name'> & {
	/** Flat page color, independent of each element's HDR background. Default: #eef1f4. */
	background?: string;
} & { [K in Exclude<keyof SpatialTheme, 'id' | 'name' | 'background'>]?: Partial<SpatialTheme[K]> };

/**
 * Creates a complete theme from a brand identity and optional appearance overrides.
 * Nested groups merge field-by-field; returned objects are independent between calls.
 * @example
 * const theme = createSpatialTheme({ id: 'shop', name: 'My shop', colors: { accent: '#285c89' } });
 */
export function createSpatialTheme(options: SpatialThemeOptions): SpatialTheme {
	return {
		id: options.id,
		name: options.name,
		background: options.background ?? '#eef1f4',
		...(options.sceneBackground ? { sceneBackground: { ...options.sceneBackground } } : {}),
		minimapTheme: {
			expandedHeight: 240,
			overlayColor: '#000000',
			overlayOpacity: 0.35,
			overlayBlur: 5,
			contextOpacity: 0,
			viewportColor: options.colors?.accent ?? '#285c89',
			...options.minimapTheme
		},
		interactionTheme: {
			outlineColor: options.colors?.accent ?? '#285c89',
			...options.interactionTheme
		},
		panelShape: { radius: 16, contentInset: 26, ...options.panelShape },
		panelTheme: {
			surface: 'frosted',
			tint: '#ffffff',
			tintOpacity: 0.65,
			backdropBlur: 8,
			shadowIntensity: 0.2,
			opacity: 1,
			...options.panelTheme
		},
		dockedPanelTheme: {
			tint: '#ffffff',
			tintOpacity: 0.92,
			backdropBlur: 5,
			shadowIntensity: 0.2,
			...options.dockedPanelTheme
		},
		sectionTheme: { tint: '#ffffff', tintOpacity: 0.8, backdropBlur: 8, ...options.sectionTheme },
		colors: {
			ink: '#173047',
			body: '#263c4d',
			accent: '#285c89',
			onAccent: '#ffffff',
			tabBackground: '#e4ebf1',
			...options.colors
		}
	};
}
