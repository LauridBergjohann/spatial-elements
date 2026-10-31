import type { SpatialSectionBackgrounds, SpatialTheme, SpatialThemeRadii } from './types.js';

const defaultSectionBackgrounds: SpatialSectionBackgrounds = {
	standard: '#ffffff',
	muted: '#f5f7f9'
};

function nonNegativeFinite(value: number | undefined, fallback: number) {
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

/** Works for both factory inputs and older complete themes without split radius roles. */
export function resolveSpatialThemeRadii(theme: {
	panelShape?: { radius?: number };
	radii?: Partial<SpatialThemeRadii>;
}): SpatialThemeRadii {
	const legacy = theme.panelShape?.radius;
	return {
		control: nonNegativeFinite(theme.radii?.control, nonNegativeFinite(legacy, 12)),
		panel: nonNegativeFinite(theme.radii?.panel, nonNegativeFinite(legacy, 16))
	};
}

/** Resolve missing new roles without changing the legacy section material or source object. */
export function resolveSpatialSectionBackgrounds(theme: {
	sectionBackgrounds?: Partial<SpatialSectionBackgrounds>;
}): SpatialSectionBackgrounds {
	const color = (value: string | undefined, fallback: string) =>
		typeof value === 'string' && value.trim() ? value.trim() : fallback;
	return {
		standard: color(theme.sectionBackgrounds?.standard, defaultSectionBackgrounds.standard),
		muted: color(theme.sectionBackgrounds?.muted, defaultSectionBackgrounds.muted)
	};
}

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
		radii: resolveSpatialThemeRadii(options),
		sectionBackgrounds: resolveSpatialSectionBackgrounds(options),
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
		panelShape: {
			...options.panelShape,
			radius: nonNegativeFinite(options.panelShape?.radius, 16),
			contentInset: nonNegativeFinite(options.panelShape?.contentInset, 26)
		},
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
