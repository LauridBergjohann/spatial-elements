<script lang="ts">
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { getContext } from 'svelte';
	import SpatialViewIcon from './SpatialViewIcon.svelte';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import ButtonGroup from '../stage/ButtonGroup.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import { useSpatialMessages } from './messagesContext.js';
	let {
		enabled,
		focusAnchor,
		onchange
	}: { enabled: boolean; focusAnchor?: HTMLElement; onchange: () => void } = $props();
	const stage = getContext<StageContext>(STAGE_CONTEXT_KEY);
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));
	const readMessages = useSpatialMessages();
	const messages = $derived(readMessages());
	const fullscreen = $derived(stage.isFullscreen?.() ?? false);
	const zoomFocus = $derived(stage.getZoomFocus?.() ?? 0);
	function select(value: string) {
		onchange();
		stage.setFullscreen?.(value === 'fullscreen');
		if (value === 'detail') stage.resetView();
	}
</script>

<ButtonGroup
	data-spatial-element-view-toggle
	label={messages.controls.detailView}
	iconOnly
	items={[
		{
			value: 'detail',
			label: messages.controls.detailView,
			selection: fullscreen ? 0 : 1 - zoomFocus
		},
		{ value: 'fullscreen', label: messages.controls.fullscreen }
	]}
	value={fullscreen ? 'fullscreen' : zoomFocus < 0.001 ? 'detail' : undefined}
	onchange={select}
	disabled={!enabled}
	visible={enabled}
	shape={{ ...theme.panelShape, radius: radii.control }}
	theme={theme.panelTheme}
	focusReactive="top-right"
	{focusAnchor}
	transitionGroup="enter"
>
	{#snippet content(item)}
		<SpatialViewIcon kind={item.value === 'detail' ? 'detail' : 'fullscreen'} />
	{/snippet}
</ButtonGroup>
