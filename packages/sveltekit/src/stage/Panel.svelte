<script lang="ts">
 import type { HTMLAttributes } from "svelte/elements";
 type StagePanelAttributes = HTMLAttributes<HTMLDivElement>;
	import { getContext, onDestroy, onMount } from 'svelte';
	import type { Snippet } from 'svelte';
	import {
		STAGE_CONTEXT_KEY,
		type StageContext,

		type StagePanelMinimapOptions,
		type StagePanelPose,
		type StagePanelShape,
		type StagePanelTheme
	} from '@spatial-elements/core/stage/panelContext';
	import { getCssPanelBoxShadow, resolvePanelShadowStrength } from '@spatial-elements/core/stage/panelShadow';
	import type { StagePanelSurface } from '@spatial-elements/core/stage/stageTypes';
	import type { CatalogTransitionGroup } from '@spatial-elements/core/catalog/catalogPresentation';
	import type { CatalogEndpointAddress } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
	import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';

	type Props = Omit<StagePanelAttributes, 'class'> & {
		children?: Snippet;
		class?: string;
		contentClass?: string;
		minimap?: boolean | StagePanelMinimapOptions;
		/** Enables proximity lift and pointer-driven tilt. Defaults to true. */
		pointerReactive?: boolean;
		pose?: StagePanelPose;
		shape: StagePanelShape;
		surface?: StagePanelSurface;
		theme?: StagePanelTheme;
		transitionGroup?: CatalogTransitionGroup;
		catalogEndpoint?: CatalogEndpointAddress;
	};

	let {
		children,
		class: frameClass = '',
		contentClass = '',
		minimap = false,
		pointerReactive = true,
		pose,
		shape,
		style: contentStyle = '',
		surface,
		theme = {},
		transitionGroup,
		catalogEndpoint,
		...rest
	}: Props = $props();

	let frameElement: HTMLDivElement;
	let surfaceElement: HTMLDivElement;
	let contentElement: HTMLDivElement;
	const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const registerEndpoint = createCatalogEndpointAction();
	const resolvedSurface = $derived(surface ?? theme.surface ?? 'glass');

	if (!stage) {
		throw new Error('Panel must be rendered inside a Stage component');
	}

	const unregister = stage.registerPanel({
		getContentInset,
		getElement: () => contentElement,
		getFrameElement: () => frameElement,
		getSurfaceElement: () => surfaceElement,
		getPointerReactive: () => pointerReactive,
		getMinimapOptions: () => getMinimapOptions(),
		getMinimapDockProgress,
		getMinimapModelScale,
		getMinimapModelTop,
		getSurface: () => resolvedSurface,
		getSurfaceOpacity,
		getOptions: getPanelOptions
	});

	onDestroy(unregister);

	onMount(() => {
		if (!getMinimapOptions()) return;

		const resetView = (event: MouseEvent) => {
			if (event.defaultPrevented || event.button !== 0) return;
			stage.resetView();
		};

		contentElement.addEventListener('click', resetView);
		return () => contentElement.removeEventListener('click', resetView);
	});

	function getContentInset() {
		return shape.contentInset ?? Math.max(16, Math.round(shape.radius * 0.7));
	}

	function getPanelOptions() {
		const visualTheme = { ...theme };
		delete visualTheme.surface;
		return {
			...visualTheme,
			...(pose ?? {}),
			radius: shape.radius
		};
	}

	function getMinimapOptions() {
		if (!minimap) return undefined;
		return minimap === true ? {} : minimap;
	}

	/** Reads the dock-controlled surface alpha while leaving HTML content untouched. */
	function getSurfaceOpacity() {
		const value = Number.parseFloat(
			frameElement?.style.getPropertyValue('--stage-panel-surface-opacity') || '1'
		);
		return Number.isFinite(value) ? clamp(value, 0, 1) : 1;
	}

	/** Reads a transient model-only scale without changing the panel geometry. */
	function getMinimapModelScale() {
		const value = Number.parseFloat(frameElement?.dataset.stageMinimapModelScale || '1');
		return Number.isFinite(value) ? clamp(value, 0.2, 2) : 1;
	}

	/** Reads the dock controller's normalized view transition. */
	function getMinimapDockProgress() {
		const value = Number.parseFloat(frameElement?.dataset.stageMinimapDockProgress || '0');
		return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
	}

	/** Reads the dock-controlled viewport anchor independently of model scale. */
	function getMinimapModelTop() {
		const value = Number.parseFloat(frameElement?.dataset.stageMinimapModelTop ?? '');
		return Number.isFinite(value) ? value : undefined;
	}

	function getFallbackStyle() {
		const tintOpacity = clamp(theme.tintOpacity ?? 0.28, 0, 1);
		const shadowIntensity = getShadowIntensity();
		const specularOpacity = clamp(theme.specularOpacity ?? 0.18, 0, 1);
		const thickness = clamp(theme.thickness ?? 0.35, 0, 1);
		const bezel = Math.max(theme.bezel ?? 18, 0);
		const backdropBlur = Math.max(theme.backdropBlur ?? 5, 0);
		const style = [
			`--stage-panel-radius: ${shape.radius}px`,
			`--stage-panel-content-inset: ${getContentInset()}px`,
			`--stage-panel-tint-rgb: ${getTintRgb()}`,
			`--stage-panel-tint-opacity: ${tintOpacity}`,
			`--stage-panel-shadow-intensity: ${shadowIntensity}`,
			`--stage-panel-shadow-strength: ${resolvePanelShadowStrength(shadowIntensity)}`,
			`--stage-panel-box-shadow: ${getCssPanelBoxShadow(shadowIntensity)}`,
			`--stage-panel-specular-opacity: ${specularOpacity}`,
			`--stage-panel-thickness: ${thickness}`,
			`--stage-panel-bezel: ${bezel}px`,
			`--stage-panel-opacity: ${clamp(theme.opacity ?? 1, 0, 1)}`,
			'--stage-panel-surface-opacity: 1',
			'--stage-panel-focus-opacity: 1',
			'--stage-panel-content-opacity: 1',
			`--stage-panel-css-blur: ${Math.min(backdropBlur, 100)}px`
		];

		if (pose) {
			style.push(
				`--stage-panel-width: ${pose.width}px`,
				`--stage-panel-height: ${pose.height}px`,
				`--stage-panel-x: ${pose.position.x}px`,
				`--stage-panel-y: ${pose.position.y}px`
			);
		}

		return style.join('; ');
	}

	function getContentThemeStyle() {
		const shadowIntensity = getShadowIntensity();
		return [
			contentStyle,
			`--stage-panel-opacity: ${clamp(theme.opacity ?? 1, 0, 1)}`,
			`--stage-panel-shadow-intensity: ${shadowIntensity}`,
			`--stage-panel-shadow-strength: ${resolvePanelShadowStrength(shadowIntensity)}`
		]
			.filter(Boolean)
			.join('; ');
	}

	function getShadowIntensity() {
		return clamp(theme.shadowIntensity ?? 0.28, 0, 1);
	}

	function getTintRgb() {
		const tint = theme.tint ?? '#ffffff';

		if (typeof tint === 'number') {
			return hexToRgb(tint.toString(16).padStart(6, '0'));
		}

		if (typeof tint === 'string') {
			const value = tint.trim().replace(/^#/, '');
			if (/^[0-9a-f]{3}$/i.test(value)) {
				return hexToRgb(value.replace(/(.)/g, '$1$1'));
			}
			if (/^[0-9a-f]{6}$/i.test(value)) {
				return hexToRgb(value);
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

<div
	bind:this={frameElement}
	data-stage-panel-fallback
	data-catalog-transition-group={transitionGroup}
	data-stage-panel-minimap={minimap ? '' : undefined}
	data-stage-minimap-docked-view-scale={getMinimapOptions()?.dockedView?.scale}
	data-stage-panel-surface={resolvedSurface}
	class={[frameClass, 'stage-panel-fallback', pose ? 'stage-panel-posed' : '']
		.filter(Boolean)
		.join(' ')}
	style={getFallbackStyle()}
>
	<div
		bind:this={surfaceElement}
		data-stage-panel-css-surface
		data-catalog-transition-group={transitionGroup}
		data-stage-panel-minimap={minimap ? '' : undefined}
		data-stage-panel-surface={resolvedSurface}
		class="stage-panel-surface"
		style={getFallbackStyle()}
	>
		<div
			{...rest}
			bind:this={contentElement}
			use:registerEndpoint={catalogEndpoint}
			data-stage-panel-content
			data-catalog-transition-group={transitionGroup}
			class={contentClass}
			style={getContentThemeStyle()}
		>
			{@render children?.()}
		</div>
	</div>
</div>

<style>
	.stage-panel-fallback {
		z-index: 2;
		box-sizing: border-box;
		border-radius: var(--stage-panel-radius);
	}

	.stage-panel-posed {
		position: absolute;
		left: calc(50% + var(--stage-panel-x) - var(--stage-panel-width) / 2);
		top: calc(50% - var(--stage-panel-y) - var(--stage-panel-height) / 2);
		width: var(--stage-panel-width);
		height: var(--stage-panel-height);
	}

	.stage-panel-surface {
		position: relative;
		z-index: 1;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		padding: var(--stage-panel-content-inset);
		border-radius: var(--stage-panel-radius);
		/* Keep opacity/filter off the element that owns backdrop-filter. Chrome
		 * otherwise creates a new Backdrop Root as soon as zoom starts. */
		opacity: 1;
		transform: translateZ(0);
		transform-style: preserve-3d;
	}

	:global([data-stage-panel-content]) {
		transform-style: preserve-3d;
		/* Content can leave its CSS surface when glass uses the DOM projection layer. */
		opacity: calc(
			var(--stage-panel-opacity, 1) * var(--stage-panel-content-opacity, 1) *
				var(--stage-transition-opacity, 1)
		);
	}

	/* A settled panel leaves every perspective ancestor so browser-native text
	 * rasterization can be used until spatial motion starts again. */
	:global([data-stage-panel-render-mode='native']),
	:global([data-stage-panel-content][data-stage-panel-render-mode='native']),
	:global([data-stage-panel-render-mode='native'] [data-stage-panel-content]) {
		transform-style: flat;
	}

	.stage-panel-surface::before,
	.stage-panel-surface::after {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		pointer-events: none;
		content: '';
		opacity: calc(
			var(--stage-panel-opacity) * var(--stage-panel-surface-opacity, 1) *
				var(--stage-panel-focus-opacity, 1) * var(--stage-transition-opacity, 1)
		);
	}

	.stage-panel-surface::before {
		background: rgb(var(--stage-panel-tint-rgb) / var(--stage-panel-tint-opacity));
		box-shadow:
			var(--stage-panel-box-shadow),
			inset 0 0 var(--stage-panel-bezel) rgb(16 24 32 / calc(var(--stage-panel-thickness) * 0.12));
		-webkit-backdrop-filter: blur(var(--stage-panel-css-blur));
		backdrop-filter: blur(var(--stage-panel-css-blur));
	}

	.stage-panel-surface[data-stage-panel-surface='solid']::before {
		-webkit-backdrop-filter: none;
		backdrop-filter: none;
	}

	.stage-panel-surface::after {
		inset: 0;
		background:
			radial-gradient(120% 72% at 50% 0%, rgb(255 255 255 / 0.72), transparent 58%),
			linear-gradient(145deg, rgb(255 255 255 / 0.58), transparent 42%);
		box-shadow: inset 0 0 var(--stage-panel-bezel) rgb(255 255 255 / 0.36);
		mix-blend-mode: screen;
		opacity: calc(
			var(--stage-panel-opacity) * var(--stage-panel-surface-opacity, 1) *
				var(--stage-panel-focus-opacity, 1) * var(--stage-panel-specular-opacity) *
				var(--stage-transition-opacity, 1)
		);
	}

	.stage-panel-surface[data-stage-panel-surface='solid']::after,
	.stage-panel-surface[data-stage-panel-surface='frosted']::after {
		display: none;
	}

	.stage-panel-surface :global([data-stage-panel-content]) {
		position: relative;
		z-index: 1;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
	}
</style>
