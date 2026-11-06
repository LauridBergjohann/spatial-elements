import { createSpatialTheme } from '@spatial-elements/core';
import { theme } from '../catalog';

export const themes = {
	light: theme,
	dark: createSpatialTheme({
		...theme,
		background: '#121923',
		sceneBackground: { tint: '#0e1622', tintIntensity: 0.86 },
		panelTheme: { ...theme.panelTheme, tint: '#172434', tintOpacity: 0.82, shadowIntensity: 0.45 },
		dockedPanelTheme: { ...theme.dockedPanelTheme, tint: '#172434', tintOpacity: 0.94 },
		sectionTheme: { ...theme.sectionTheme, tint: '#172434', tintOpacity: 0.9 },
		sectionBackgrounds: { standard: '#172434', muted: '#243548' },
		colors: { ink: '#edf4fc', body: '#c8d6e7', accent: '#80bfff', onAccent: '#102438', tabBackground: '#243548' },
		minimapTheme: { ...theme.minimapTheme, viewportColor: '#80bfff' },
		interactionTheme: { outlineColor: '#80bfff' }
	})
};
