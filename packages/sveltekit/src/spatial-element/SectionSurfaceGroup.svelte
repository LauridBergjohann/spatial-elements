<script lang="ts">
 import { SectionSurfaceGroup } from '@page-sections/svelte';
 import { getContext, type Snippet } from 'svelte';
 import { SECTION_PAGE_KIND } from '@spatial-elements/core/spatial-element/spatialElementSectionRegistry';
 let { children }: { children?: Snippet } = $props();
 const pageKind = getContext<'content' | 'detail'>(SECTION_PAGE_KIND) ?? 'detail';
</script>
<SectionSurfaceGroup {pageKind}>{@render children?.()}</SectionSurfaceGroup>
