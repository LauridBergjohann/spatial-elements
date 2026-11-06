import { createSpatialTheme } from '@spatial-elements/core';

// Palette adapted from bergjohann.com (src/app.css), revision 5463b79.
// Both palettes share a namespace so appearance changes keep the stage alive.
export const themes = {
	light: createSpatialTheme({
		id: 'showcase', name: 'Spatial Elements Showcase', background: '#ffffff',
		sectionBackgrounds: { standard: '#ffffff', muted: '#f0f0f0' },
		colors: { ink: '#141414', body: '#262626', accent: '#007b5e', onAccent: '#ffffff', tabBackground: '#eeeeee' },
		panelTheme: { tint: '#ffffff', tintOpacity: 0.86 },
		dockedPanelTheme: { tint: '#ffffff', tintOpacity: 0.94 },
		sectionTheme: { tint: '#ffffff', tintOpacity: 0.9 },
		sceneBackground: { tint: '#dee2e1', tintIntensity: 0.3 },
		radii: { control: 8, panel: 12 }
	}),
	dark: createSpatialTheme({
		id: 'showcase', name: 'Spatial Elements Showcase', background: '#1c1e22',
		sectionBackgrounds: { standard: '#1c1e22', muted: '#373b3f' },
		colors: { ink: '#e5e5e6', body: '#cacbcc', accent: '#06795e', onAccent: '#cae2dd', tabBackground: '#30343a' },
		panelTheme: { tint: '#23272f', tintOpacity: 0.9, shadowIntensity: 0.4 },
		dockedPanelTheme: { tint: '#23272f', tintOpacity: 0.96 },
		sectionTheme: { tint: '#23272f', tintOpacity: 0.94 },
		sceneBackground: { tint: '#1c1e22', tintIntensity: 0.86 },
		interactionTheme: { outlineColor: '#0fac87' },
		radii: { control: 8, panel: 12 }
	})
};
