<script lang="ts">
	import { getContext, onMount, tick, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolveMenuOffset } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import { Navigation } from '@page-sections/svelte';
	import type { MenuItem } from '@page-sections/core';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import { useSpatialTheme } from './brandContext.js';
	import './layout.generated.css';

	let { menu, items, brand, tools, left, right }: { menu?: Snippet; items?: MenuItem[]; brand?: Snippet; tools?: Snippet; left?: Snippet; right?: Snippet } = $props();
	const stageContext = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	$effect(() => { void theme; void fixedDetail; stageContext?.updatePanelAppearance?.(); });
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
		// Shared navigation owns the boxes; the stage only enhances their surfaces.
        const releases = [...rack.querySelectorAll<HTMLElement>('.header, .satellite')].map(element => {
            const role = element.classList.contains('header') ? 'menu' : element.classList.contains('left') ? 'left' : 'right';
            element.setAttribute('data-spatial-shell-' + role, '');
            element.classList.add('spatial-shell-' + (role === 'menu' ? 'menu' : 'satellite'));
            element.dataset.stagePanelNativeContent = '';
            return stageContext?.registerPanel({
                getElement: () => element, getFrameElement: () => element, getSurfaceElement: () => element,
                getContentInset: () => 0, getPointerReactive: () => false, getFocusReactive: () => true,
                getNativeContent: () => true, getVisible: () => element.getClientRects().length > 0,
                getMinimapOptions: () => undefined, getMinimapDockProgress: () => 0,
                getMinimapModelScale: () => 1, getMinimapModelTop: () => undefined,
                getSurface: () => fixedDetail ? theme.panelTheme.surface ?? 'glass' : 'frosted',
                getSurfaceOpacity: () => 1,
                getOptions: () => ({ ...theme.panelTheme, radius: role === 'menu' ? radii.panel : radii.control })
            });
        });
        const stop = subscribeStageScrollFrame(frame => position(frame.scrollY), STAGE_SCROLL_PRIORITY.virtualDocument + 1);
		window.addEventListener('resize', updateMode, { passive: true });
		return () => { releases.forEach(release => release?.()); stop(); observer.disconnect(); window.removeEventListener('resize', updateMode); };
	});
</script>

<div class="spatial-shell-track" data-spatial-navigation-shell>
 <div bind:this={rack} class="spatial-shell-rack" data-stage-scroll-shell data-catalog-shell data-spatial-navigation-glass={fixedDetail && theme.panelTheme.surface === 'glass' ? '' : undefined}>
  <Navigation {menu} {items} {brand} {tools} {left} {right} />
 </div>
</div>
<style>
 .spatial-shell-track { position: relative; z-index: 30; height: calc(var(--ps-nav-height) + var(--ps-sticky-range)); margin-bottom: calc(-1 * var(--ps-sticky-range)); pointer-events: none; }
 .spatial-shell-rack { position: sticky; top: 0; height: var(--ps-nav-height); pointer-events: none; }
 .spatial-shell-rack :global(.ps-navigation) { pointer-events: auto; }
 :global(.stage-virtual-scroll-active) .spatial-shell-rack { position: relative; transform: translateY(var(--spatial-shell-scroll-compensation, 0px)); }
 [data-spatial-navigation-glass] :global([data-stage-panel-bound]) { background: transparent; box-shadow: none; }
</style>
