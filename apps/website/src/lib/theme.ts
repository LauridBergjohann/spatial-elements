import { createSpatialTheme } from '@spatial-elements/core';
import type { PageTheme } from '@page-sections/core';

/** Shared website palette, adapted from Page Sections. */
export function websitePageTheme(mode: 'light' | 'dark') {
	return (
		mode === 'dark'
			? {
					background: '#3b4047',
					standard: '#1f2126',
					muted: '#23272e',
					ink: '#e5e5e6', // hsl(220, 2%, 90%)
					body: '#ffffff',
					accent: '#219471',
					onAccent: '#1c1e22',
					radius: '12px',
					fontFamily: 'system-ui, sans-serif',
					footerBackground: '#212126',
					footerInk: '#aaaaaa',
					footerBarBackground: '#262a30',
					footerBarInk: 'hsl(220, 5%, 65%)'
				}
			: {
					background: '#e7ebe9',
					standard: '#ffffff',
					muted: '#f2f2f2',
					ink: '#141414',
					body: '#666666',
					accent: '#007b5e',
					onAccent: '#ffffff',
					radius: '12px',
					fontFamily: 'system-ui, sans-serif',
					footerBackground: '#007b5e',
					footerInk: '#ffffff',
					footerBarBackground: '#bdbdbd',
					footerBarInk: '#333333'
				}
	) satisfies PageTheme;
}

/** Route-scoped showcase identities retain the same collection namespace. */
export function websiteTheme(
	mode: 'light' | 'dark',
	namespace: string,
	variant: 'default' | 'industrial' | 'exclusive' = 'default'
) {
	if (variant === 'industrial') return industrialTheme(mode, namespace);
	if (variant === 'exclusive') return watchesTheme(mode, namespace);
	const palette = websitePageTheme(mode);
	const { background, standard, muted } = palette;
	return createSpatialTheme({
		id: namespace,
		name: 'Spatial Elements',
		background,
		sceneBackground: { tint: background, tintIntensity: 1, blurriness: 0.5 },
		radii: { panel: 12, control: 12 },
		interactionTheme: { outlineOpacity: 0.96, outlineThickness: 3 },
		panelShape: { radius: 12, contentInset: 26 },
		sectionBackgrounds: { standard, muted },
		colors: {
			border: mode === 'dark' ? 'hsl(219, 10%, 34%)' : '#d1d1d1',
			ink: palette.ink,
			body: palette.body,
			accent: palette.accent,
			onAccent: palette.onAccent,
			tabBackground: mode === 'dark' ? '#1f1f1f' : '#eeeeee'
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

/** One teal-blue accent in both modes, with compact frosted surfaces. */
function industrialTheme(mode: 'light' | 'dark', namespace: string) {
	const dark = mode === 'dark';
	const background = dark ? '#131a22' : '#eef1f3';
	const standard = dark ? '#1b2734' : '#ffffff';
	const accent = '#135a77';
	return createSpatialTheme({
		id: namespace,
		name: 'Industrial',
		background,
		sceneBackground: { tint: background, tintIntensity: 1, blurriness: 0.5 },
		radii: { panel: 8, control: 8 },
		panelShape: { radius: 8, contentInset: 30 },
		minimapTheme: { viewportColor: accent },
		interactionTheme: { outlineColor: accent, outlineOpacity: 1, outlineThickness: 3 },
		panelTheme: {
			surface: 'frosted',
			tint: standard,
			tintOpacity: dark ? 0.8 : 0.6,
			backdropBlur: 5,
			shadowIntensity: dark ? 0.55 : 0.25
		},
		dockedPanelTheme: {
			tint: standard,
			tintOpacity: 0.94,
			backdropBlur: 5,
			shadowIntensity: dark ? 0.55 : 0.25
		},
		sectionTheme: { tint: standard, tintOpacity: dark ? 0.9 : 0.78, backdropBlur: 50 },
		sectionBackgrounds: { standard, muted: dark ? '#2c3a4b' : '#f5f7f9' },
		colors: {
			ink: dark ? '#f1f5fa' : '#141414',
			body: dark ? '#cbd5e1' : '#111827',
			accent,
			onAccent: '#ffffff',
			tabBackground: dark ? '#2c3a4b' : '#e1e5e8'
		}
	});
}

/** Adapted from the Watches brand example; collection identity stays unchanged. */
function watchesTheme(mode: 'light' | 'dark', namespace: string) {
	const dark = mode === 'dark';
	const background = dark ? '#181b23' : '#4d525e';
	const standard = dark ? '#15171c' : '#2f3135';
	const muted = dark ? '#23262d' : '#464646';
	const accent = dark ? '#d5b975' : '#caa75c';
	return createSpatialTheme({
		id: namespace,
		name: 'Spatial Elements',
		background,
		sceneBackground: { tint: background, tintIntensity: dark ? 0.8 : 0.35, blurriness: 0.5 },
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
			tint: dark ? '#101217' : '#1f1f1f',
			tintOpacity: dark ? 0.8 : 0.6,
			bezel: 20,
			thickness: 0.45,
			specularOpacity: 0.2,
			shadowIntensity: dark ? 0.8 : 0.65,
			opacity: 1
		},
		dockedPanelTheme: {
			backdropBlur: 5,
			tint: dark ? '#23262d' : '#464646',
			tintOpacity: 0.9,
			shadowIntensity: 1
		},
		sectionTheme: { tint: standard, tintOpacity: dark ? 0.85 : 0.7, backdropBlur: 10 },
		sectionBackgrounds: { standard, muted },
		colors: {
			ink: '#ffffff',
			body: dark ? '#e1e3e7' : '#f7f7f4',
			accent,
			onAccent: '#161718',
			tabBackground: dark ? 'rgb(6 8 12 / 0.8)' : 'rgb(29 30 32 / 0.76)'
		}
	});
}
