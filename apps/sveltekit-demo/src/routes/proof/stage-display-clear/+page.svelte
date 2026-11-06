<script lang="ts">
	import { onMount } from 'svelte';
	import { runStageDisplayClearProof } from './proof';
	let output: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true;
		void runStageDisplayClearProof(output).then(result => {
			if (!active) return;
			Object.assign(window, { __stageDisplayClearProof: result }); state = 'ready';
		}, error => {
			if (!active) return;
			Object.assign(window, { __stageDisplayClearProof: { error: String(error) } }); state = 'error';
		});
		return () => { active = false; };
	});
</script>

<h1>Stage display clear pixel proof</h1>
<p data-stage-display-proof-state={state}>{state}</p>
<div bind:this={output}></div>
