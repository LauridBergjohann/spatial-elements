<script lang="ts">
 import { resolve } from '$app/paths';
 import { Breadcrumbs } from '@page-sections/svelte';
 import { getContext, onMount } from 'svelte';
 import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
 import { getPanelFocusProgress } from '@spatial-elements/core/stage/panelFocusMath';
 import { subscribeStageScrollFrame, STAGE_SCROLL_PRIORITY } from '@spatial-elements/core/stage/scrollFrame';
 import type { SpatialElementBreadcrumb } from '@spatial-elements/core/spatial-element/types';
 let { items, transition = 'enter', focusReactive = true }: { items: SpatialElementBreadcrumb[]; transition?: 'enter' | 'exit'; focusReactive?: boolean } = $props();
 const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
 const focus = $derived(focusReactive ? getPanelFocusProgress(stage?.getZoomUiFocus?.() ?? 0) : 0);
 let element: HTMLDivElement;
 let menu = $state<HTMLElement>();
 let menuSize = $state({ width: 0, height: 0 });
 onMount(() => {
  menu = element.closest('.stage')?.querySelector<HTMLElement>('[data-spatial-shell-menu]') ?? undefined;
  if (!menu) return;
  const measure = () => { menuSize = { width: menu!.offsetWidth, height: menu!.offsetHeight }; };
  const occlude = () => {
   const rect = element.getBoundingClientRect(), header = menu!.getBoundingClientRect();
   const overlap = header.bottom - rect.top;
   // The breadcrumb stays in its own document/zoom path. Hide its overlap
   // with the glass surface rather than making that surface opaque.
   const mask = overlap > 0 && rect.left < header.right && rect.right > header.left
    ? `linear-gradient(to bottom, transparent ${overlap}px, #000 ${overlap + Math.min(overlap, 12)}px)` : '';
   if (element.style.maskImage !== mask) element.style.maskImage = mask;
  };
  measure();
  occlude();
  const stopScroll = subscribeStageScrollFrame(occlude, STAGE_SCROLL_PRIORITY.stage + 1);
  const observer = new ResizeObserver(() => { measure(); occlude(); }); observer.observe(menu);
  return () => { observer.disconnect(); stopScroll(); };
 });
 const travel = $derived.by(() => {
  if (!focus) return '0px 0px';
  if (!menu) return `0px ${-112 * focus}px`;
  // The native shell receives the exact GPU projection in the same frame.
  // Follow its lower-left corner, including perspective expansion.
  const matrix = new DOMMatrixReadOnly(menu.style.transform || undefined);
  return `${matrix.m41 - menuSize.width * (matrix.a - 1) / 2}px ${matrix.m42 + menuSize.height * (matrix.d - 1) / 2}px`;
 });
 const resolved = $derived(items.map(item => ({ ...item, href: item.href ? resolve(...([item.href] as unknown as Parameters<typeof resolve>)) : undefined })));
</script>
<div bind:this={element} class="breadcrumbs spatial-content-width" style:translate={travel} style:filter={focus > 0 ? `blur(${focus * 4}px)` : 'none'} data-stage-dom-content data-catalog-transition-dom={transition}>
 <Breadcrumbs items={resolved} />
</div>
<style>
 .breadcrumbs { height: var(--ps-breadcrumb-height); padding-inline: var(--ps-grid-gap, 12px); box-sizing: border-box; pointer-events: auto; overflow-x: auto; scrollbar-width: none; direction: rtl; }
 .breadcrumbs :global(nav) { direction: ltr; width: max-content; min-width: 100%; height: 100%; }
 .breadcrumbs :global(ol) { flex-wrap: nowrap; }
 .breadcrumbs :global(li) { white-space: nowrap; }
</style>
