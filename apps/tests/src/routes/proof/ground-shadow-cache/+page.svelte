<script lang="ts">
	import { onMount } from 'svelte';
	import { runGroundCacheProof } from './proof';
	let output: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true;
		void runGroundCacheProof(output).then(
			(result) => {
				if (!active) return;
				Object.assign(window, { __groundCacheProof: result });
				state = 'ready';
			},
			(error) => {
				if (!active) return;
				Object.assign(window, { __groundCacheProof: { error: String(error) } });
				state = 'error';
			}
		);
		return () => {
			active = false;
		};
	});
</script>

<h1>Ground silhouette cache pixel proof</h1>
<p data-ground-proof-state={state}>{state}</p>
<div bind:this={output}></div>
