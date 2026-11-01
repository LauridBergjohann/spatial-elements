<script lang="ts">
	import { onMount } from 'svelte';
	import { runDeferredScrollWarmupProof } from './proof';
	let host: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true;
		void runDeferredScrollWarmupProof(host).then(result => {
			if (!active) return;
			Object.assign(window, { __deferredScrollWarmupProof: result }); state = 'ready';
		}, error => {
			if (!active) return;
			const failure = { error: String(error), stack: error instanceof Error ? error.stack : undefined };
			Object.assign(window, { __deferredScrollWarmupProof: failure });
			console.error('Deferred scroll warmup proof failed', failure.error, failure.stack);
			state = 'error';
		});
		return () => { active = false; };
	});
</script>

<h1>Deferred scroll warmup pixel proof</h1>
<p data-scroll-warmup-proof-state={state}>{state}</p>
<div bind:this={host}></div>
