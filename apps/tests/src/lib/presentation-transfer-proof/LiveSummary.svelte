<script lang="ts">
	import { onMount } from 'svelte';
	import type { SpatialSummaryContext } from '@spatial-elements/sveltekit';
	let { context }: { context: SpatialSummaryContext } = $props();
	let count = $state(1),
		note = $state('');
	onMount(() => {
		const state = ((window as any).__presentationProof ??= { mounts: 0, destroys: 0 });
		state.mounts++;
		return () => {
			state.destroys++;
		};
	});
</script>

<section data-live-transfer-summary>
	<h3>{context.spatialElement.title}</h3>
	<div data-transfer-fields>
		<label>Retained note<input bind:value={note} /></label><button
			type="button"
			onclick={() => count++}>Add retained quantity</button
		>
	</div>
	<output data-transfer-state>{note || 'Empty'}: {count}</output>
</section>

<style>
	h3 {
		margin: 0 0 12px;
	}
	[data-transfer-fields] {
		display: grid;
		gap: 10px;
		grid-template-columns: minmax(0, 1fr);
	}
	input {
		width: 100%;
		box-sizing: border-box;
	}
	@container spatial-summary (min-width: 400px) {
		[data-transfer-fields] {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
</style>
