import { createSpatialTheme } from '@spatial-elements/core';

/** The shared website identity, with a route-scoped Watches glass showcase. */
export function websiteTheme(mode: 'light' | 'dark', namespace: string, exclusive = false) {
	if (exclusive) return watchesTheme(mode, namespace);
	const dark = mode === 'dark';
	const background = dark ? '#393c44' : '#e0e4e3';
	const standard = dark ? '#1c1e22' : '#ffffff';
	const muted = dark ? '#23262f' : '#f2f2f2';
	return createSpatialTheme({
		// Stable collection identity; independent of URL structure and visual appearance.
		id: namespace,
		name: 'Spatial Elements',
		background,
		sceneBackground: { tint: background, tintIntensity: 1, blurriness: 0.5 },
		radii: { panel: 12, control: 12 },
		interactionTheme: { outlineOpacity: 0.96, outlineThickness: 3 },
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

/** Adapted from the Watches brand example; collection identity stays unchanged. */
function watchesTheme(mode: 'light' | 'dark', namespace: string) {
	const dark = mode === 'dark';
	const background = dark ? '#4d525e' : '#eef1f3';
	const standard = dark ? '#2f3135' : '#ffffff';
	const muted = dark ? '#464646' : '#e1e5e8';
	const accent = dark ? '#caa75c' : '#806020';
	return createSpatialTheme({
		id: namespace,
		name: 'Spatial Elements',
		background,
		sceneBackground: { tint: background, tintIntensity: dark ? 0.35 : 0.65, blurriness: 0.5 },
		radii: { panel: 22, control: 22 },
		panelShape: { radius: 22, contentInset: 30 },
		minimapTheme: {
			expandedHeight: 244,
			overlayColor: '#000000',
			overlayOpacity: 0.4,
			overlayBlur: 5,
			contextOpacity: 0,
			viewportColor: accent
		},
		interactionTheme: { outlineColor: accent, outlineOpacity: 0.96, outlineThickness: 3 },
		panelTheme: {
			surface: 'glass',
			backdropBlur: 5,
			refraction: 20,
			tint: dark ? '#1f1f1f' : '#ffffff',
			tintOpacity: dark ? 0.6 : 0.7,
			bezel: 20,
			thickness: 0.45,
			specularOpacity: 0.2,
			shadowIntensity: dark ? 0.65 : 0.25,
			opacity: 1
		},
		dockedPanelTheme: {
			backdropBlur: 5,
			tint: dark ? '#464646' : '#ffffff',
			tintOpacity: 0.9,
			shadowIntensity: dark ? 1 : 0.25
		},
		sectionTheme: { tint: standard, tintOpacity: dark ? 0.7 : 0.85, backdropBlur: 10 },
		sectionBackgrounds: { standard, muted },
		colors: {
			ink: dark ? '#ffffff' : '#212327',
			body: dark ? '#f7f7f4' : '#303940',
			accent,
			onAccent: dark ? '#161718' : '#ffffff',
			tabBackground: dark ? 'rgb(29 30 32 / 0.76)' : '#e1e5e8'
		}
	});
}
