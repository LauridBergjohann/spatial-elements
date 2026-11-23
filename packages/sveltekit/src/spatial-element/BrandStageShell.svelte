<script lang="ts">
	import type { MenuItem } from '@page-sections/core';
	import type { Snippet } from 'svelte';
	import { STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { preventBrowserPinch } from '@spatial-elements/core/stage/browserPinch';
	import '@page-sections/svelte/styles.css';
	import { retainDeviceOrientationPermission } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import Stage from '../stage/Stage.svelte';
	import PointerHint from './PointerHint.svelte';
	import SpatialNavigationShell from './SpatialNavigationShell.svelte';
	import SpatialSummaryHost from './SpatialSummaryHost.svelte';
	import type { SpatialSummarySnippet } from './spatialSummary.js';
	import type { StageRenderSettings } from '@spatial-elements/core';
	import { getSpatialThemeStyle } from './spatialThemeStyle.js';
	import { provideSpatialTheme } from './brandContext.js';
	import { provideSpatialMessages } from './messagesContext.js';
	import type { SpatialMessagesInput } from '@spatial-elements/core/spatial-element/messages';
	import type { SpatialTheme } from '@spatial-elements/core/spatial-element/types';

	interface Props {
		/** Enable sensor motion on detail geometry and minimaps. Lists opt in independently. */
		deviceOrientation?: boolean;
		/** Shared appearance and namespace. Use createSpatialTheme for defaults. */
		theme: SpatialTheme;
		/** Resolved by the host. System preference and persistence belong to the shell. */
		colorScheme?: 'light' | 'dark';
		/** Localized interface copy. Missing groups/strings fall back to English; updates are reactive. */
		messages?: SpatialMessagesInput;
		/** Optional GPU resolution budget; defaults to DPR 1 and 2,073,600 pixels. */
		renderSettings?: StageRenderSettings;
		/** Draco decoder directory, including trailing slash. Default: /assets/draco/gltf/; the host must serve the files. */
		dracoDecoderPath?: string;
		/** Layout contents. ContentPage and SpatialElementPage register their own data. */
		children?: Snippet;
		/** Document footer; scrolls over the stationary stage in every layout. */
		footer?: Snippet;
		/** Persistent main-menu content. The shell owns its box and surface. */
		menu?: Snippet;
		/** Complete application navigation; the spatial shell supplies positioning and surfaces. */
		navigation?: Snippet;
		/** Shared responsive navigation; menu remains a custom-content escape hatch. */
		items?: MenuItem[];
		brand?: Snippet;
		tools?: Snippet;
		/** Persistent, synchronous summary content. Receives element data and the presentation mode. */
		summary?: SpatialSummarySnippet;
		/** Optional 80x40 satellite contents, visible from XL and available through Settings on smaller layouts. */
		left?: Snippet;
		right?: Snippet;
	}

	let { theme, colorScheme, messages, renderSettings, dracoDecoderPath, children, footer, menu, navigation, items, brand, tools, summary, left, right, deviceOrientation = false }: Props = $props();
	let shell = $state<HTMLDivElement>();
	let footerHost = $state<HTMLDivElement>();
	$effect(() => {
		const stage = shell?.querySelector<HTMLElement>('.stage');
		if (!stage || !footerHost) return;
		const host = footerHost;
		let previous = 0;
		// Only the footer follows the existing visual wheel smoothing. No stage
		// geometry reads, inherited style writes or canvas displacement are needed.
		const stop = subscribeStageScrollFrame(frame => {
			const offset = stage.classList.contains('stage-virtual-scroll-active') ? frame.targetScrollY - frame.scrollY : 0;
			if (offset === previous) return;
			previous = offset;
			host.style.translate = offset ? `0 ${offset}px` : '';
		}, STAGE_SCROLL_PRIORITY.virtualDocument);
		return () => { stop(); host.style.removeProperty('translate'); };
	});
	$effect(() => {
		if (deviceOrientation) return retainDeviceOrientationPermission();
	});

	provideSpatialTheme(() => theme);
	provideSpatialMessages(() => messages);

	const brandStyle = $derived(getSpatialThemeStyle(theme));
	function attachPinchPolicy(node: HTMLElement) { return { destroy: preventBrowserPinch(node) }; }
</script>

<div bind:this={shell} use:attachPinchPolicy class="brand-stage-shell" style={brandStyle} style:color-scheme={colorScheme} data-color-scheme={colorScheme}>
	<Stage
		{deviceOrientation}
		brandId={theme.id}
		{renderSettings}
		{dracoDecoderPath}
		pageBackground={theme.background}
		sceneBackground={theme.sceneBackground}
		interactionTheme={theme.interactionTheme}
		ariaLabel={`${theme.name} spatialElement stage`}
	>
		{#if navigation || menu || items || brand || left || right}<SpatialNavigationShell {navigation} {menu} {items} {brand} {tools} {left} {right} />{/if}
		<SpatialSummaryHost {summary}>{@render children?.()}</SpatialSummaryHost>
	</Stage>
	{#if footer}<div bind:this={footerHost} class="spatial-footer">{@render footer()}</div>{/if}
	<PointerHint />
</div>

<style>
	:global(:where(.brand-stage-shell) a) { text-decoration: none; text-underline-offset: 0.2em; }
	:global(:where(.brand-stage-shell) a:hover) { text-decoration: underline; }
	:global(.brand-stage-shell .ps-navigation a:hover) { text-decoration: none; }
	.spatial-footer { position: relative; z-index: 31; padding-top: 48px; }
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
