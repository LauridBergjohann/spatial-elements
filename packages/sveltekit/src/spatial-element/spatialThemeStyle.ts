import type { SpatialTheme } from '@spatial-elements/core/spatial-element/types';
import {
	resolveSpatialSectionBackgrounds,
	resolveSpatialThemeRadii
} from '@spatial-elements/core/spatial-element/spatialTheme';
import {
	getCssPanelBoxShadow,
	resolvePanelShadowStrength
} from '@spatial-elements/core/stage/panelShadow';

/** CSS declarations shared by the shell and optional server-rendered theme previews. */
export function getSpatialThemeStyle(theme: SpatialTheme) {
	const radii = resolveSpatialThemeRadii(theme);
	const sectionBackgrounds = resolveSpatialSectionBackgrounds(theme);
	return [
        `--ps-background: transparent`,
        `--ps-ink: ${theme.colors.ink}`,
        `--ps-body: ${theme.colors.body}`,
        `--ps-accent: ${theme.colors.accent}`,
        `--ps-on-accent: ${theme.colors.onAccent}`,
        `--ps-section-standard: ${sectionBackgrounds.standard}`,
        `--ps-section-muted: ${sectionBackgrounds.muted}`,
        `--ps-radius: ${radii.panel}px`,
        `--ps-font-family: Inter, ui-sans-serif, system-ui, sans-serif`,
        `--ps-border: color-mix(in srgb, ${theme.colors.ink} 18%, transparent)`,
        `--ps-scroll-offset: var(--spatial-element-section-scroll-offset, 150px)`,
		`--spatial-element-background: ${theme.background}`,
		`--spatial-element-ink: ${theme.colors.ink}`,
		`--spatial-element-body: ${theme.colors.body}`,
		`--spatial-element-accent: ${theme.colors.accent}`,
		`--spatial-element-on-accent: ${theme.colors.onAccent}`,
		`--spatial-element-section-tint: ${theme.sectionTheme.tint}`,
		`--spatial-element-section-standard: ${sectionBackgrounds.standard}`,
		`--spatial-element-section-muted: ${sectionBackgrounds.muted}`,
		`--spatial-element-section-tint-opacity: ${toPercentage(theme.sectionTheme.tintOpacity)}`,
		`--spatial-element-section-backdrop-blur: ${clamp(theme.sectionTheme.backdropBlur, 0, 100)}px`,
		`--spatial-element-tab-background: ${theme.colors.tabBackground}`,
		`--spatial-element-control-radius: ${radii.control}px`,
		`--spatial-element-panel-radius: ${radii.panel}px`,
		`--spatial-element-docked-panel-tint-rgb: ${getDockedPanelTintRgb(theme.dockedPanelTheme.tint)}`,
		`--spatial-element-docked-panel-tint-opacity: ${clamp(theme.dockedPanelTheme.tintOpacity, 0, 1)}`,
		`--spatial-element-docked-panel-shadow-intensity: ${clamp(theme.dockedPanelTheme.shadowIntensity, 0, 1)}`,
		`--spatial-element-docked-panel-shadow-strength: ${resolvePanelShadowStrength(theme.dockedPanelTheme.shadowIntensity)}`,
		`--spatial-element-docked-panel-box-shadow: ${getCssPanelBoxShadow(theme.dockedPanelTheme.shadowIntensity)}`,
		`--spatial-element-docked-panel-backdrop-blur: ${clamp(theme.dockedPanelTheme.backdropBlur, 0, 100)}px`
	].join('; ');
}

function toPercentage(value: number) {
	return `${clamp(value, 0, 1) * 100}%`;
}

function getDockedPanelTintRgb(tint: SpatialTheme['dockedPanelTheme']['tint']) {
	const value = tint;

	if (typeof value === 'number') {
		return hexToRgb(value.toString(16).padStart(6, '0'));
	}

	if (typeof value === 'string') {
		const hex = value.trim().replace(/^#/, '');
		if (/^[0-9a-f]{3}$/i.test(hex)) {
			return hexToRgb(hex.replace(/(.)/g, '$1$1'));
		}
		if (/^[0-9a-f]{6}$/i.test(hex)) {
			return hexToRgb(hex);
		}
	}

	return '255 255 255';
}

function hexToRgb(hex: string) {
	const value = Number.parseInt(hex, 16);
	return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

function clamp(value: number, min: number, max: number) {
	return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : min;
}
