<script lang="ts">
 import { getContext } from 'svelte';
 import type { SpatialPresentationModel, SpatialSummarySnippet } from './spatialSummary.js';
 import SpatialCardPresentation from './SpatialCardPresentation.svelte';
 import { createCatalogEndpointAction } from '../catalog/catalogEndpointAction.js';
 import { useCatalogNavigation } from '../catalog/catalogNavigation.js';
 import { catalogViewLink } from '@spatial-elements/core/catalog/catalogViewLink';
 import { CATALOG_ENDPOINTS, type CatalogEndpointRegistry } from '@spatial-elements/core/catalog/CatalogEndpointRegistry';
 import { CATALOG_SECTIONS, type CatalogSections } from '@spatial-elements/core/catalog/CatalogSections';
 let { content, model }: { content: SpatialSummarySnippet; model: SpatialPresentationModel } = $props();
 const context = $derived(model.kind === 'summary' ? model.current : undefined);
 const carousel = $derived(context?.carousel);
 const catalogEndpoint = createCatalogEndpointAction();
 const endpoints = getContext<CatalogEndpointRegistry | undefined>(CATALOG_ENDPOINTS);
 const sections = getContext<CatalogSections | undefined>(CATALOG_SECTIONS);
 const { href, prepare } = useCatalogNavigation();
 function activate(event: MouseEvent) {
  if (!model.active || !context || !carousel) { event.preventDefault(); return; }
  endpoints?.prefer(context.spatialElement.brandId, context.spatialElement.id, carousel.occurrence, 'carousel.front');
  sections?.activate({ brandId: context.spatialElement.brandId, spatialElementId: context.spatialElement.id, occurrence: carousel.occurrence, slot: 'carousel.front' });
  (event.currentTarget as HTMLElement).focus({ preventScroll: true });
 }
 function prepareCarousel() { if (model.active && carousel) prepare(carousel.item); }
</script>
{#if model.kind === 'card'}
 <SpatialCardPresentation {...model.current} active={model.active} />
{:else}
 <div class="spatial-summary-surface" hidden={model.current.mode !== 'carousel'} aria-hidden="true"></div>
 {#if model.current.carousel}
  <div class="compact-copy" hidden={model.current.mode !== 'carousel'}>
   {#if model.current.spatialElement.eyebrow}<p use:catalogEndpoint={model.active && carousel?.compact ? model.current.address('eyebrow') : undefined}>{model.current.spatialElement.eyebrow}</p>{/if}
   <h3 use:catalogEndpoint={model.active && carousel?.compact ? model.current.address('title') : undefined}>{model.current.spatialElement.title}</h3>
  </div>
 {/if}
 <div data-spatial-summary-root class="spatial-summary-query" class:full-summary={model.current.mode === 'carousel'}>
  {@render content(model.active && !carousel?.compact ? model.current : { ...model.current, address: () => undefined })}
 </div>
 {#if model.current.carousel}
  {#if model.current.carousel.item.summary?.sectionLink}<a class="section-information" href={href(model.current.carousel.item.summary.sectionLink.href)} onclick={activate}
   use:catalogViewLink={{ spatialElementId: model.current.spatialElement.id, targetPresentation: model.current.carousel.item.summary.sectionLink.targetPresentation }}
   data-catalog-focus-key={`catalog-section:${model.current.carousel.occurrence}`}>{model.current.carousel.item.summary.sectionLink.label}</a>{/if}
  <a class="information" href={href(model.current.carousel.item.href)} onclick={activate} onpointerenter={prepareCarousel} onfocus={prepareCarousel} onpointerdown={prepareCarousel}
   use:catalogViewLink={{ spatialElementId: model.current.spatialElement.id, targetPresentation: model.current.carousel.item.targetPresentation }}
   aria-label={`More information: ${model.current.spatialElement.title}`}
   data-catalog-focus-key={`catalog:${JSON.stringify([model.current.spatialElement.brandId, model.current.spatialElement.id, model.current.carousel.occurrence, 'carousel.front'])}`}>
   <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
  </a>
 {/if}
{/if}
<style>
 :global(.spatial-summary-island) { position: relative; width: 100%; min-width: 0; box-sizing: border-box; }
 .spatial-summary-query {
  container: spatial-summary / inline-size; width: 100%; min-width: 0; pointer-events: auto;
  max-height: max(0px, calc(var(--spatial-detail-summary-max-height, 100000px) - var(--spatial-summary-content-inset, 0px) * 2 - var(--spatial-summary-height-reserve, 0px)));
  overflow: auto; overscroll-behavior: auto;
 }
 :global(.spatial-summary-island[data-presentation-mode='carousel']) { height: 100%; border-radius: var(--carousel-panel-radius, 14px); opacity: var(--carousel-panel-opacity, 1); }
 .spatial-summary-surface {
  position: absolute; inset: 0; border-radius: inherit; background: color-mix(in srgb, var(--carousel-panel-tint, white) var(--carousel-panel-tint-opacity, 65%), transparent);
  border: 1px solid color-mix(in srgb, var(--spatial-element-accent) 12%, transparent); backdrop-filter: blur(var(--carousel-panel-blur, 5px)); box-shadow: var(--carousel-panel-shadow); pointer-events: none;
 }
 .spatial-summary-surface[hidden] { display: none; }
 :global([data-carousel-glass-ready]) .spatial-summary-surface,
 :global([data-spatial-presentation-glass]) .spatial-summary-surface { visibility: hidden; }
 .compact-copy { position: relative; padding-right: 44px; }
 .compact-copy p { height: 26px; margin: 0; font-size: 12px; line-height: 26px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
 .compact-copy h3 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; height: 40px; margin: 0; overflow: hidden; font-size: 18px; line-height: 20px; }
 .full-summary, .section-information { display: none; }
 .information { position: absolute; top: 0; right: 0; display: grid; place-items: center; width: 40px; height: 40px; margin: 0; color: var(--spatial-element-accent); pointer-events: auto; }
 .information svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
 @media (min-width: 840px) {
  :global(.spatial-summary-island[data-presentation-mode='carousel']) { height: auto; padding: var(--spatial-summary-content-inset); }
  .compact-copy { display: none; }
  .full-summary { display: block; position: relative; }
  /* Optional section navigation belongs outside the shared property surface. */
  .section-information { display: block; position: absolute; top: calc(100% + 8px); left: 0; right: 0; height: 32px; line-height: 32px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--spatial-element-accent); }
 }
</style>
