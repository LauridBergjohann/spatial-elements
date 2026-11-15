<script lang="ts">
 import { resolve } from '$app/paths';
 import { Breadcrumbs } from '@page-sections/svelte';
 import { getContext } from 'svelte';
 import { STAGE_CONTEXT_KEY, type StageContext } from '@spatial-elements/core/stage/panelContext';
 import { getPanelFocusProgress } from '@spatial-elements/core/stage/panelFocusMath';
 import type { SpatialElementBreadcrumb } from '@spatial-elements/core/spatial-element/types';
 let { items, transition = 'enter', focusReactive = true }: { items: SpatialElementBreadcrumb[]; transition?: 'enter' | 'exit'; focusReactive?: boolean } = $props();
 const stage = getContext<StageContext | undefined>(STAGE_CONTEXT_KEY);
 const focus = $derived(focusReactive ? getPanelFocusProgress(stage?.getZoomUiFocus?.() ?? 0) : 0);
 const resolved = $derived(items.map(item => ({ ...item, href: item.href ? resolve(...([item.href] as unknown as Parameters<typeof resolve>)) : undefined })));
</script>
<div class="breadcrumbs spatial-content-width" style:translate={`0 ${-112 * focus}px`} data-stage-dom-content data-catalog-transition-dom={transition}>
 <Breadcrumbs items={resolved} />
</div>
<style>
 .breadcrumbs { height: var(--ps-breadcrumb-height); padding-inline: var(--ps-grid-gap, 12px); box-sizing: border-box; pointer-events: auto; overflow-x: auto; scrollbar-width: none; direction: rtl; }
 .breadcrumbs :global(nav) { direction: ltr; width: max-content; min-width: 100%; height: 100%; }
 .breadcrumbs :global(ol) { flex-wrap: nowrap; }
 .breadcrumbs :global(li) { white-space: nowrap; }
</style>
