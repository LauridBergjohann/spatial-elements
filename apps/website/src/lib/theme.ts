import { createSpatialTheme } from '@spatial-elements/core';

/** One visual identity for documentation, examples and every showcase product. */
export function websiteTheme(mode: 'light' | 'dark', namespace: string) {
	const dark = mode === 'dark';
	const background = dark ? '#393c44' : '#e0e4e3';
	const standard = dark ? '#1c1e22' : '#ffffff';
	const muted = dark ? '#23262f' : '#f2f2f2';
	return createSpatialTheme({
		// The namespace matches collection URLs; it does not select a different appearance.
		id: namespace,
		name: 'Spatial Elements',
		background,
		sceneBackground: { tint: background, tintIntensity: 1, blurriness: 0.5 },
		radii: { panel: 12, control: 12 },
		panelShape: { radius: 12, contentInset: 26 },
		sectionBackgrounds: { standard, muted },
		colors: {
			ink: dark ? '#e5e5e6' : '#141414',
			body: dark ? '#a1a4aa' : '#666666',
			accent: dark ? '#09a782' : '#007b5e',
			onAccent: dark ? standard : '#ffffff',
			tabBackground: dark ? 'rgba(72, 77, 83, 0.5)' : '#eeeeee'
		},
		panelTheme: {
			surface: 'frosted',
			tint: standard,
			tintOpacity: 0.8,
			backdropBlur: 16,
			shadowIntensity: 0.2
		},
		dockedPanelTheme: { tint: standard, tintOpacity: 0.9, backdropBlur: 16, shadowIntensity: 0.2 },
		sectionTheme: { tint: standard, tintOpacity: 0.8, backdropBlur: 16 }
	});
}
