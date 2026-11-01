<script lang="ts">
	import { onMount } from 'svelte';
	import { createBackgroundCheckpoints } from '../background-layer-output/checkpoints';
	import { runCatalogWarmOutputProof } from './proof';
	let host: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true;
		const checkpoints = createBackgroundCheckpoints();
		const api = { getCurrent: checkpoints.getCurrent, release: checkpoints.release };
		Object.assign(window, { __catalogWarmOutputCheckpoints: api });
		void runCatalogWarmOutputProof(host, checkpoints.wait, evidence => {
			if (active) Object.assign(window, { __catalogWarmOutputEvidence: evidence });
		}).then(result => {
			if (active) { Object.assign(window, { __catalogWarmOutputProof: result }); state = 'ready'; }
		}, error => {
			if (active) {
				Object.assign(window, { __catalogWarmOutputProof: { error: String(error), stack: error instanceof Error ? error.stack : null,
					evidence: error && typeof error === 'object' && 'evidence' in error ? error.evidence : undefined } });
				state = 'error';
			}
		});
		return () => {
			active = false; checkpoints.dispose();
			if (Reflect.get(window, '__catalogWarmOutputCheckpoints') === api) Reflect.deleteProperty(window, '__catalogWarmOutputCheckpoints');
		};
	});
</script>

<div class="status">
	<h1>Isolated catalog warm-output proof</h1>
	<p data-catalog-warm-proof-state={state}>{state}</p>
</div>
<div bind:this={host}></div>

<style>
	.status { position: fixed; left: 280px; top: 8px; z-index: 200; font: 12px/16px sans-serif; pointer-events: none; }
	h1 { font-size: 16px; }
</style>
