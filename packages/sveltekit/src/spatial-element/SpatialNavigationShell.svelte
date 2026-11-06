<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolveMenuOffset } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import Panel from '../stage/Panel.svelte';
	import { useSpatialTheme } from './brandContext.js';
	import './layout.generated.css';

	let { menu, left, right }: { menu?: Snippet; left?: Snippet; right?: Snippet } = $props();
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	const radii = $derived(resolveSpatialThemeRadii(theme));
	let rack: HTMLDivElement;
	let stage: HTMLElement | undefined;
	let enhancedScroll = false;
	let fixedDetail = $state(false);

	function position(scrollY = getStageVisualScrollPosition().scrollY) {
		if (!rack) return;
		const compensation = enhancedScroll ? Math.max(0, scrollY) + resolveMenuOffset(scrollY, fixedDetail) : 0;
		rack.style.setProperty('--spatial-shell-scroll-compensation', `${compensation}px`);
		// PageBinding removes precisely this DOM compensation before caching document coordinates.
		rack.dataset.stageScrollCompensation = String(compensation);
		rack.toggleAttribute('data-stage-scroll-shell-fixed', fixedDetail);
	}
	function updateMode() {
		if (!rack || !stage) return;
		const previousMode = `${enhancedScroll}/${fixedDetail}`;
		enhancedScroll = stage.classList.contains('stage-virtual-scroll-active');
		fixedDetail = getComputedStyle(rack).getPropertyValue('--spatial-shell-fixed').trim() === '1';
		position();
		if (previousMode !== `${enhancedScroll}/${fixedDetail}`) window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
	}
	function closePopovers() {
		for (const element of rack?.querySelectorAll<HTMLElement>(':popover-open') ?? []) element.hidePopover();
		for (const details of rack?.querySelectorAll<HTMLDetailsElement>('details[open]') ?? []) details.open = false;
	}
	afterNavigate(() => { void tick().then(updateMode); });
	beforeNavigate(closePopovers);

	onMount(() => {
		stage = rack.closest<HTMLElement>('.stage') ?? undefined;
		updateMode();
		const observer = new MutationObserver(updateMode);
		if (stage) observer.observe(stage, { attributes: true, attributeFilter: ['class'] });
		const stop = subscribeStageScrollFrame(frame => position(frame.scrollY), STAGE_SCROLL_PRIORITY.virtualDocument + 1);
		window.addEventListener('resize', updateMode, { passive: true });
		return () => { stop(); observer.disconnect(); window.removeEventListener('resize', updateMode); };
	});
</script>

<div class="spatial-shell-track" data-spatial-navigation-shell>
	<div bind:this={rack} class="spatial-shell-rack" data-stage-scroll-shell data-catalog-shell>
		{#if menu}
			<Panel class="spatial-shell-menu spatial-content-width" nativeContent pointerReactive={false}
				surface={fixedDetail ? theme.panelTheme.surface : 'frosted'}
				shape={{ radius: radii.panel, contentInset: 0 }} theme={theme.panelTheme}
				contentClass="spatial-shell-menu-content" data-spatial-shell-menu>
				{@render menu()}
			</Panel>
		{/if}
		{#if left}
			<Panel class="spatial-shell-satellite spatial-shell-left" nativeContent pointerReactive={false}
				surface={fixedDetail ? theme.panelTheme.surface : 'frosted'}
				shape={{ radius: radii.control, contentInset: 0 }} theme={theme.panelTheme}
				contentClass="spatial-shell-satellite-content" data-spatial-shell-left>
				{@render left()}
			</Panel>
		{/if}
		{#if right}
			<Panel class="spatial-shell-satellite spatial-shell-right" nativeContent pointerReactive={false}
				surface={fixedDetail ? theme.panelTheme.surface : 'frosted'}
				shape={{ radius: radii.control, contentInset: 0 }} theme={theme.panelTheme}
				contentClass="spatial-shell-satellite-content" data-spatial-shell-right>
				{@render right()}
			</Panel>
		{/if}
	</div>
</div>

<style>
	.spatial-shell-track {
		position: relative;
		z-index: 30;
		height: calc(var(--spatial-shell-reserve) + var(--spatial-shell-sticky-range));
		margin-bottom: calc(-1 * var(--spatial-shell-sticky-range));
		pointer-events: none;
	}
	.spatial-shell-rack {
		position: sticky;
		top: 0;
		width: 100%;
		height: var(--spatial-shell-reserve);
		pointer-events: none;
	}
	:global(.stage-virtual-scroll-active) .spatial-shell-rack {
		position: relative;
		transform: translateY(var(--spatial-shell-scroll-compensation, 0px));
	}
	:global(.spatial-shell-menu) {
		position: absolute;
		top: var(--spatial-shell-menu-top);
		left: 0;
		right: 0;
		height: var(--spatial-shell-menu-height);
		pointer-events: auto;
	}
	:global(.spatial-shell-menu-content) {
		box-sizing: border-box;
		display: flex;
		align-items: center;
		width: 100%;
		height: 100%;
		padding: 0 12px;
	}
	:global(.spatial-shell-satellite) {
		position: absolute;
		top: var(--spatial-shell-satellite-top);
		width: var(--spatial-shell-satellite-width);
		height: var(--spatial-shell-satellite-height);
		pointer-events: auto;
	}
	:global(.spatial-shell-left) { left: var(--spatial-shell-satellite-inset); }
	:global(.spatial-shell-right) { right: var(--spatial-shell-satellite-inset); }
	:global(.spatial-shell-satellite-content) { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; }
</style>
