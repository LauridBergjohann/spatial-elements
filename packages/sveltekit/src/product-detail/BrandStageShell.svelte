<script lang="ts">
	import type { Snippet } from 'svelte';
	import Stage from '../stage/Stage.svelte';
	import type { CatalogPage } from '@spatial-elements/core/catalog/catalogPage';
	import { getCssPanelBoxShadow, resolvePanelShadowStrength } from '@spatial-elements/core/stage/panelShadow';
	import { provideProductBrand } from './brandContext.js';
	import type { ProductBrandTheme, ProductStageConfig } from '@spatial-elements/core/product-detail/types';

	interface Props {
		theme: ProductBrandTheme;
		stage: ProductStageConfig;
		catalog?: CatalogPage;
		children?: Snippet;
	}

	let { theme, stage, catalog, children }: Props = $props();

	provideProductBrand(() => theme);

	const brandStyle = $derived(
		[
			`--product-background: ${theme.background}`,
			`--product-ink: ${theme.colors.ink}`,
			`--product-body: ${theme.colors.body}`,
			`--product-accent: ${theme.colors.accent}`,
			`--product-on-accent: ${theme.colors.onAccent}`,
			`--product-section-tint: ${theme.sectionTheme.tint}`,
			`--product-section-tint-opacity: ${toPercentage(theme.sectionTheme.tintOpacity)}`,
			`--product-section-backdrop-blur: ${Math.max(theme.sectionTheme.backdropBlur, 0)}px`,
			`--product-tab-background: ${theme.colors.tabBackground}`,
			`--product-panel-radius: ${theme.panelShape.radius}px`,
			`--product-docked-panel-tint-rgb: ${getDockedPanelTintRgb(theme.dockedPanelTheme.tint)}`,
			`--product-docked-panel-tint-opacity: ${clamp(theme.dockedPanelTheme.tintOpacity, 0, 1)}`,
			`--product-docked-panel-shadow-intensity: ${clamp(theme.dockedPanelTheme.shadowIntensity, 0, 1)}`,
			`--product-docked-panel-shadow-strength: ${resolvePanelShadowStrength(theme.dockedPanelTheme.shadowIntensity)}`,
			`--product-docked-panel-box-shadow: ${getCssPanelBoxShadow(theme.dockedPanelTheme.shadowIntensity)}`,
			`--product-docked-panel-backdrop-blur: ${Math.min(
				Math.max(theme.dockedPanelTheme.backdropBlur, 0),
				100
			)}px`
		].join('; ')
	);

	function toPercentage(value: number) {
		return `${clamp(value, 0, 1) * 100}%`;
	}

	function getDockedPanelTintRgb(tint: ProductBrandTheme['dockedPanelTheme']['tint']) {
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
		ariaLabel={`${theme.name} product stage`}
	>
		{@render children?.()}
	</Stage>
</div>

<style>
	.brand-stage-shell {
		background: var(--product-background);
		--product-content-inline-inset: 192px;
		--product-shell-inline-inset: 192px;
	}

	:global(.stage) {
		color: var(--product-ink);
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
</style>
