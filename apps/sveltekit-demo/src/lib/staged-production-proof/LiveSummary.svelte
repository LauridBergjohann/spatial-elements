<script lang="ts">
	import { createCatalogEndpointAction, type SpatialSummaryContext } from '@spatial-elements/sveltekit';
	let { context }: { context: SpatialSummaryContext } = $props();
	const endpoint = createCatalogEndpointAction();
	let note = $state('A retained configuration');
</script>
<p use:endpoint={context.address('eyebrow')}>{context.spatialElement.eyebrow}</p>
<svelte:element this={context.heading} class="heading" id={context.heading === 'h1' ? 'spatial-element-title' : undefined}
	use:endpoint={context.address('title')}>{context.spatialElement.title}</svelte:element>
<label>Configuration note<textarea bind:value={note}></textarea></label>
<p>The field and its component remain the same when this summary becomes the detail presentation.</p>
<style>
	p { margin: 0 0 8px; }
	.heading { margin: 0 0 12px; font-size: 24px; line-height: 32px; }
	label { display: grid; gap: 8px; margin-bottom: 16px; }
	textarea { box-sizing: border-box; width: 100%; min-height: 60px; font: inherit; resize: vertical; }
</style>
