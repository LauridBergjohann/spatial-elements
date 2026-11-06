<script lang="ts">
 import { getContext, onDestroy, tick, type Snippet } from 'svelte';
 import { onNavigate } from '$app/navigation';
 import { SPATIAL_SUMMARY_HOST, type SpatialSummaryHostController, type RetainedSpatialPresentation } from '../../../../../packages/sveltekit/dist/spatial-element/spatialSummaryHost.svelte.js';
 let { children }: { children: Snippet } = $props();
 const host = getContext<SpatialSummaryHostController>(SPATIAL_SUMMARY_HOST);
 let held: RetainedSpatialPresentation | undefined;
 let phase = $state('ready');
 let projection: HTMLDivElement;
 let finish: (() => void) | undefined;
 function holdSource() {
  const source = document.querySelector('[data-transfer-source] [data-spatial-presentation-root]');
  if (!source) return;
  held = host.retainByElement(source);
  const box = held!.hold(projection);
  projection.style.left = box.left + 'px'; projection.style.top = box.top + 'px';
  phase = 'test-held';
 }
 onDestroy(() => { held?.release(); finish?.(); });
 onNavigate(({to}) => {
  if (!to?.url.pathname.endsWith('/presentation-transfer/detail')) return;
  const source = document.querySelector('[data-transfer-source] [data-spatial-presentation-root]');
  if (!source) return;
  held = host.retainByElement(source);
  if (!held) throw new Error('Missing production presentation');
  held.freeze();
  phase = 'frozen';
  return new Promise<() => void>(resolve => {
   finish = () => {
    finish = undefined;
    const box = held!.hold(projection);
    projection.style.left = box.left + 'px'; projection.style.top = box.top + 'px';
    phase = 'held';
    resolve(() => { void (async () => {
     await tick(); await new Promise(requestAnimationFrame);
     const slot = document.querySelector<HTMLElement>('[data-transfer-destination] [data-spatial-summary-slot]')!;
     const adopted = held!.adopt(slot);
     if (adopted) { held!.unfreeze(); held!.release(); phase = 'adopted'; }
     else phase = 'content';
    })(); });
   };
  });
 });
</script>
<div data-transfer-proof data-phase={phase}>
 <nav><a href="/proof/presentation-transfer/summary">Summary source</a><a href="/proof/presentation-transfer/card">Card source</a><a href="/proof/persistence-exit">Leave owner</a></nav>
 <button type="button" onclick={() => finish?.()} disabled={phase !== 'frozen'}>Finish source motion</button>
 <button type="button" onclick={() => { held?.release(); phase = 'released'; }} disabled={phase !== 'content'}>Finish content reveal</button>
 <button type="button" onclick={holdSource} disabled={phase !== 'ready'}>Hold source without routing</button>
 <button type="button" onclick={() => { phase = held?.restore() ? 'restored' : 'restore-failed'; }} disabled={phase !== 'test-held'}>Restore cancelled source</button>
 {@render children()}
 <div data-transfer-projection bind:this={projection}></div>
</div>
<style>
 [data-transfer-proof] { padding: 130px 40px 40px; pointer-events: auto; }
 nav { display:flex; gap:16px; }
 button { margin:16px 10px 16px 0; }
 [data-transfer-projection] { position:fixed; z-index:5000; pointer-events:none; }
</style>
