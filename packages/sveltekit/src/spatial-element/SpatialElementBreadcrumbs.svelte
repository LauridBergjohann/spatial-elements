<script lang="ts">
 import { resolve } from '$app/paths';
 import { Breadcrumbs } from '@page-sections/svelte';
 import type { SpatialElementBreadcrumb } from '@spatial-elements/core/spatial-element/types';
 let { items, transition = 'enter' }: { items: SpatialElementBreadcrumb[]; transition?: 'enter' | 'exit' } = $props();
 const resolved = $derived(items.map(item => ({ ...item, href: item.href ? resolve(...([item.href] as unknown as Parameters<typeof resolve>)) : undefined })));
</script>
<div class="breadcrumbs spatial-content-width" data-stage-dom-content data-catalog-transition-dom={transition}>
 <Breadcrumbs items={resolved} />
</div>
<style>
 .breadcrumbs { height: var(--ps-breadcrumb-height); padding-inline: var(--ps-grid-gap, 12px); box-sizing: border-box; pointer-events: auto; overflow-x: auto; scrollbar-width: none; direction: rtl; }
 .breadcrumbs :global(nav) { direction: ltr; width: max-content; min-width: 100%; height: 100%; }
 .breadcrumbs :global(ol) { flex-wrap: nowrap; }
 .breadcrumbs :global(li) { white-space: nowrap; }
</style>
