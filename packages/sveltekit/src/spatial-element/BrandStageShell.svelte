<script lang="ts">
	import type { Snippet } from 'svelte';
	import Stage from '../stage/Stage.svelte';
	import type { CatalogPage } from '@spatial-elements/core/catalog/catalogPage';
	import { getCssPanelBoxShadow, resolvePanelShadowStrength } from '@spatial-elements/core/stage/panelShadow';
	import { provideSpatialTheme } from './brandContext.js';
	import type { SpatialTheme, SpatialStageConfig } from '@spatial-elements/core/spatial-element/types';

	interface Props {
		theme: SpatialTheme;
		stage: SpatialStageConfig;
		catalog?: CatalogPage;
		children?: Snippet;
	}

	let { theme, stage, catalog, children }: Props = $props();

	provideSpatialTheme(() => theme);

	const brandStyle = $derived(
		[
			`--spatial-element-background: ${theme.background}`,
			`--spatial-element-ink: ${theme.colors.ink}`,
			`--spatial-element-body: ${theme.colors.body}`,
			`--spatial-element-accent: ${theme.colors.accent}`,
			`--spatial-element-on-accent: ${theme.colors.onAccent}`,
			`--spatial-element-section-tint: ${theme.sectionTheme.tint}`,
			`--spatial-element-section-tint-opacity: ${toPercentage(theme.sectionTheme.tintOpacity)}`,
			`--spatial-element-section-backdrop-blur: ${Math.max(theme.sectionTheme.backdropBlur, 0)}px`,
			`--spatial-element-tab-background: ${theme.colors.tabBackground}`,
			`--spatial-element-panel-radius: ${theme.panelShape.radius}px`,
			`--spatial-element-docked-panel-tint-rgb: ${getDockedPanelTintRgb(theme.dockedPanelTheme.tint)}`,
			`--spatial-element-docked-panel-tint-opacity: ${clamp(theme.dockedPanelTheme.tintOpacity, 0, 1)}`,
			`--spatial-element-docked-panel-shadow-intensity: ${clamp(theme.dockedPanelTheme.shadowIntensity, 0, 1)}`,
			`--spatial-element-docked-panel-shadow-strength: ${resolvePanelShadowStrength(theme.dockedPanelTheme.shadowIntensity)}`,
			`--spatial-element-docked-panel-box-shadow: ${getCssPanelBoxShadow(theme.dockedPanelTheme.shadowIntensity)}`,
			`--spatial-element-docked-panel-backdrop-blur: ${Math.min(
				Math.max(theme.dockedPanelTheme.backdropBlur, 0),
				100
			)}px`
		].join('; ')
	);

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
		return Math.min(Math.max(value, min), max);
	}
</script>

<div class="brand-stage-shell" style={brandStyle}>
	<Stage
		{catalog}
		background={stage.background}
		pageBackground={theme.background}
		hdr={stage.hdr}
		glb={stage.glb}
		lodPair={stage.lodPair}
		model={stage.model}
		camera={stage.camera}
		interactionTheme={theme.interactionTheme}
		ariaLabel={`${theme.name} spatialElement stage`}
	>
		{@render children?.()}
	</Stage>
</div>

<style>
	.brand-stage-shell {
		background: var(--spatial-element-background);
		--spatial-element-content-inline-inset: 192px;
		--spatial-element-shell-inline-inset: 192px;
	}

	:global(.stage) {
		color: var(--spatial-element-ink);
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
</style>
