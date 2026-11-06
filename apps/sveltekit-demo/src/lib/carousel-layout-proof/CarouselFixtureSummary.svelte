<script lang="ts">
	import type { SpatialSummaryContext } from '@spatial-elements/sveltekit';
	let { context, long }: { context: SpatialSummaryContext; long: boolean } = $props();
	let note = $state('');
	let quantity = $state(1);
</script>
<h3>{context.spatialElement.title}</h3>
<label>Option for {context.spatialElement.title}<input bind:value={note} /></label>
<button type="button" onclick={() => quantity++}>Add one {context.spatialElement.title}</button>
<p data-carousel-custom-state>{note || 'Unconfigured'}: {quantity}</p>
{#if long}{#each Array(12) as _, index}<p>Detailed property {index + 1} contributes variable summary height while the carousel's fit frame remains fixed.</p>{/each}{/if}
<style>
	h3 { margin: 0 40px 12px 0; font-size: 24px; line-height: 1.2; }
	label { display: grid; gap: 4px; }
	input { width: 100%; box-sizing: border-box; }
	button { margin-top: 12px; }
</style>
