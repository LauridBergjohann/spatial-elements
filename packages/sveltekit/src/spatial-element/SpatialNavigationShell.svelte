<script lang="ts">
	import { getContext, onMount, tick, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolveMenuOffset, spatialLayoutTokens } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import { Navigation } from '@page-sections/svelte';
	import { layoutTokens, type MenuItem } from '@page-sections/core';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import { useSpatialTheme } from './brandContext.js';
	import './layout.generated.css';

	let { navigation, menu, items, brand, tools, left, right }: { navigation?: Snippet; menu?: Snippet; items?: MenuItem[]; brand?: Snippet; tools?: Snippet; left?: Snippet; right?: Snippet } = $props();
	const stageContext = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	$effect(() => { void theme; void fixedDetail; stageContext?.updatePanelAppearance?.(); });
	const radii = $derived(resolveSpatialThemeRadii(theme));
	let rack: HTMLDivElement;
	let stage: HTMLElement | undefined;
	let enhancedScroll = false;
	let satellitesVisible = false;
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
		satellitesVisible = window.innerWidth >= layoutTokens.layoutMinWidths.xl;
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
		// Projected panel content lives above the ordinary DOM layer. Promote only
		// open navigation dropdowns to the browser top layer, retaining their DOM
		// ownership, shared markup and delegated events.
		const dropdownStyles = new Map<HTMLElement, string | null>();
		function restoreDropdown(panel: HTMLElement) {
			if (!dropdownStyles.has(panel)) return;
			if (panel.matches(':popover-open')) panel.hidePopover();
			panel.removeAttribute('popover');
			const style = dropdownStyles.get(panel);
			if (style === null) panel.removeAttribute('style');
			else panel.setAttribute('style', style!);
			dropdownStyles.delete(panel);
		}
		function toggleDropdown(event: Event) {
			if (!(event.target instanceof HTMLDetailsElement)) return;
			const details = event.target;
			const panel = details.querySelector<HTMLElement>(':scope > .settings-panel, :scope > .mobile-panel, :scope > .ps-submenu');
			if (!panel || !('showPopover' in panel)) return;
			// Nested menu entries stay inside their already elevated parent panel.
			if (details.closest('.mobile-panel, .ps-submenu')) return;
			if (!details.open) { restoreDropdown(panel); return; }
			if (dropdownStyles.has(panel)) return;
			const rect = panel.getBoundingClientRect();
			dropdownStyles.set(panel, panel.getAttribute('style'));
			panel.popover = 'manual';
			Object.assign(panel.style, { position: 'fixed', inset: 'auto', margin: '0',
				left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px',
				boxSizing: 'border-box', maxHeight: Math.max(0, innerHeight - rect.top - 12) + 'px', overflowY: 'auto' });
			panel.showPopover();
		}
		rack.addEventListener('toggle', toggleDropdown, true);
		window.addEventListener('scroll', closePopovers, { passive: true });
		window.addEventListener('resize', closePopovers, { passive: true });
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
                getNativeContent: () => true, getVisible: () => role === 'menu' || satellitesVisible,
                getMinimapOptions: () => undefined, getMinimapDockProgress: () => 0,
                getMinimapModelScale: () => 1, getMinimapModelTop: () => undefined,
                getSurface: () => fixedDetail ? theme.panelTheme.surface ?? 'glass' : 'frosted',
                getSurfaceOpacity: () => 1,
                getOptions: () => ({ ...theme.panelTheme, radius: role === 'menu' ? radii.panel : radii.control })
            });
        });
        const stop = subscribeStageScrollFrame(frame => position(frame.scrollY), STAGE_SCROLL_PRIORITY.virtualDocument + 1);
		window.addEventListener('resize', updateMode, { passive: true });
		return () => {
			rack.removeEventListener('toggle', toggleDropdown, true);
			window.removeEventListener('scroll', closePopovers);
			window.removeEventListener('resize', closePopovers);
			for (const panel of dropdownStyles.keys()) restoreDropdown(panel);
			releases.forEach(release => release?.()); stop(); observer.disconnect(); window.removeEventListener('resize', updateMode); };
	});
</script>

<div class="spatial-shell-track" style:--ps-sticky-range={`${spatialLayoutTokens.menu.scrollThreshold}px`} data-spatial-navigation-shell>
 <div bind:this={rack} class="spatial-shell-rack" data-stage-scroll-shell data-catalog-shell data-spatial-navigation-glass={fixedDetail && theme.panelTheme.surface === 'glass' ? '' : undefined}>
  {#if navigation}{@render navigation()}{:else}<Navigation {menu} {items} {brand} {tools} {left} {right} />{/if}
 </div>
</div>
<style>
 .spatial-shell-track { position: relative; z-index: 30; height: calc(var(--ps-nav-height) + var(--ps-sticky-range)); margin-bottom: calc(-1 * var(--ps-sticky-range)); pointer-events: none; }
 .spatial-shell-rack { position: sticky; top: 0; height: var(--ps-nav-height); pointer-events: none; }
 .spatial-shell-rack :global(.ps-navigation) { pointer-events: auto; }
 /* Native navigation retains its semantic DOM and shares the spatial material,
  * including the SSR/no-GPU fallback. GPU glass replaces only its surface. */
 .spatial-shell-rack :global(.header),
 .spatial-shell-rack :global(.satellite) {
  background: rgb(var(--spatial-element-panel-tint-rgb) / var(--spatial-element-panel-tint-opacity));
  -webkit-backdrop-filter: blur(var(--spatial-element-panel-backdrop-blur));
  backdrop-filter: blur(var(--spatial-element-panel-backdrop-blur));
  box-shadow: var(--spatial-element-panel-box-shadow);
 }
 :global(.stage-virtual-scroll-active) .spatial-shell-rack { position: relative; transform: translateY(var(--spatial-shell-scroll-compensation, 0px)); }
 [data-spatial-navigation-glass] :global([data-stage-panel-bound]) { background: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
</style>
