<script lang="ts">
	import { getContext, onMount, tick, type Snippet } from 'svelte';
	import { afterNavigate, beforeNavigate } from '$app/navigation';
	import { resolveMenuOffset, spatialLayoutTokens } from '@spatial-elements/core/spatial-element/responsiveLayout';
	import { resolveSpatialThemeRadii } from '@spatial-elements/core/spatial-element/spatialTheme';
	import { getStageVisualScrollPosition, STAGE_SCROLL_PRIORITY, subscribeStageScrollFrame } from '@spatial-elements/core/stage/scrollFrame';
	import { STAGE_PANEL_LAYOUT_EVENT } from '@spatial-elements/core/stage/panelContext';
	import { Header } from '@page-sections/svelte';
	import { layoutTokens, type MenuItem } from '@page-sections/core';
	import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
	import { useSpatialTheme } from './brandContext.js';
	import './layout.generated.css';

	let { navigation, menu, items, brand, tools, left, right }: { navigation?: Snippet; menu?: Snippet; items?: MenuItem[]; brand?: Snippet; tools?: Snippet; left?: Snippet; right?: Snippet } = $props();
	const stageContext = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
	const readTheme = useSpatialTheme();
	const theme = $derived(readTheme());
	$effect(() => { void theme; void fixedDetail; void edgeToEdge; stageContext?.updatePanelAppearance?.(); });
	const radii = $derived(resolveSpatialThemeRadii(theme));
	let rack: HTMLDivElement;
	let stage: HTMLElement | undefined;
	let enhancedScroll = false;
	let satellitesVisible = false;
	let fixedDetail = $state(false);
	let edgeToEdge = $state(true);

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
		edgeToEdge = !satellitesVisible;
		fixedDetail = getComputedStyle(rack).getPropertyValue('--spatial-shell-fixed').trim() === '1';
		position();
		if (previousMode !== `${enhancedScroll}/${fixedDetail}`) window.dispatchEvent(new Event(STAGE_PANEL_LAYOUT_EVENT));
	}
	function closePopovers() {
		// Let the owning components close their state as well as their top-layer panels.
		if (rack?.querySelector(':popover-open')) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
		for (const details of rack?.querySelectorAll<HTMLDetailsElement>('details[open]') ?? []) details.open = false;
	}
	afterNavigate(() => { void tick().then(updateMode); });
	beforeNavigate((navigation) => { if (!navigation.shallow || navigation.type === 'popstate') closePopovers(); });

	onMount(() => {
		stage = rack.closest<HTMLElement>('.stage') ?? undefined;
		updateMode();
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
                getSurface: () => theme.panelTheme.surface ?? 'frosted',
                getSurfaceOpacity: () => 1,
                getOptions: () => ({ ...theme.panelTheme, radius: role === 'menu' ? (edgeToEdge ? 0 : radii.panel) : radii.control })
            });
        });
        const stop = subscribeStageScrollFrame(frame => position(frame.scrollY), STAGE_SCROLL_PRIORITY.virtualDocument + 1);
		window.addEventListener('resize', updateMode, { passive: true });
		return () => {
			window.removeEventListener('scroll', closePopovers);
			window.removeEventListener('resize', closePopovers);
			releases.forEach(release => release?.()); stop(); observer.disconnect(); window.removeEventListener('resize', updateMode); };
	});
</script>

<div class="spatial-shell-track" style:--ps-sticky-range={`${spatialLayoutTokens.menu.scrollThreshold}px`} data-spatial-navigation-shell>
 <div bind:this={rack} class="spatial-shell-rack" data-stage-scroll-shell data-catalog-shell data-spatial-navigation-glass={theme.panelTheme.surface === 'glass' ? '' : undefined}>
  {#if navigation}{@render navigation()}{:else}<Header scrollBehavior="static" {menu} {items} {brand} {tools} {left} {right} />{/if}
 </div>
</div>
<style>
 /* Apply the shared popup presentation with published Page Sections 0.5.1 too. */
 :global(.brand-stage-shell[data-ps-popups-enhanced]) .spatial-shell-rack :global(.menu-backdrop) { display: none; }
 .spatial-shell-rack :global(details[open] > summary) { color: var(--ps-accent); background: var(--ps-selection, var(--ps-section-muted)); }
 .spatial-shell-rack :global(summary) { transition: color 180ms ease, background-color 180ms ease; }
 .spatial-shell-rack :global(.ps-main-menu) { flex-wrap: nowrap; }
 .spatial-shell-rack :global(.ps-main-menu > li) { flex: none; }
 .spatial-shell-rack :global(.ps-main-menu > li > a) { white-space: nowrap; }
 @media (prefers-reduced-motion: reduce) { .spatial-shell-rack :global(summary) { transition: none; } }
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
 .spatial-shell-rack :global(.header) { border-radius: var(--spatial-element-panel-radius); }
 .spatial-shell-rack :global(.satellite) { border-radius: var(--spatial-element-control-radius); }
 :global(.stage-virtual-scroll-active) .spatial-shell-rack { position: relative; transform: translateY(var(--spatial-shell-scroll-compensation, 0px)); }
 [data-spatial-navigation-glass] :global([data-stage-panel-bound]) { background: transparent; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
@media (width < 1600px) { .spatial-shell-rack :global(.header) { border-radius: 0; } }
</style>
