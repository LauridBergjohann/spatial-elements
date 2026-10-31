<script lang="ts">
	import type { Snippet } from 'svelte';
	import { retainDeviceOrientationPermission } from '@spatial-elements/core/catalog/listDeviceOrientation';
	import Stage from '../stage/Stage.svelte';
	import PointerHint from './PointerHint.svelte';
	import SpatialNavigationShell from './SpatialNavigationShell.svelte';
	import type { StageRenderSettings } from '@spatial-elements/core';
	import { getSpatialThemeStyle } from './spatialThemeStyle.js';
	import { provideSpatialTheme } from './brandContext.js';
	import { provideSpatialMessages } from './messagesContext.js';
	import type { SpatialMessagesInput } from '@spatial-elements/core/spatial-element/messages';
	import type { SpatialTheme } from '@spatial-elements/core/spatial-element/types';

	interface Props {
		/** Enable automatic sensor access / permission on internal navigation for opted-in lists. */
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
		/** Persistent main-menu content. The shell owns its box and surface. */
		menu?: Snippet;
		/** Optional 80x40 satellite contents, visible from XL. Expose their actions in menu on smaller layouts. */
		left?: Snippet;
		right?: Snippet;
	}

	let { theme, colorScheme, messages, renderSettings, dracoDecoderPath, children, menu, left, right, deviceOrientation = false }: Props = $props();
	$effect(() => {
		if (deviceOrientation) return retainDeviceOrientationPermission();
	});

	provideSpatialTheme(() => theme);
	provideSpatialMessages(() => messages);

	const brandStyle = $derived(getSpatialThemeStyle(theme));
</script>

<div class="brand-stage-shell" style={brandStyle} style:color-scheme={colorScheme} data-color-scheme={colorScheme}>
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
		{#if menu || left || right}<SpatialNavigationShell {menu} {left} {right} />{/if}
		{@render children?.()}
	</Stage>
	<PointerHint />
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
