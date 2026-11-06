<script lang="ts">
	import { onMount } from 'svelte';
	import { runDeferredScrollWarmupProof } from './proof';
	import { createScrollWarmupCheckpoints } from './checkpoints';
	let host: HTMLDivElement;
	let state = $state('preparing');
	onMount(() => {
		let active = true;
		const checkpoints = createScrollWarmupCheckpoints();
		const api = { getCurrent: checkpoints.getCurrent, release: checkpoints.release };
		Object.assign(window, { __deferredScrollWarmupCheckpoints: api });
		void runDeferredScrollWarmupProof(host, checkpoints.wait).then(result => {
			if (!active) return;
			Object.assign(window, { __deferredScrollWarmupProof: result }); state = 'ready';
		}, error => {
			if (!active) return;
			const failure = { error: String(error), stack: error instanceof Error ? error.stack : undefined };
			Object.assign(window, { __deferredScrollWarmupProof: failure });
			console.error('Deferred scroll warmup proof failed', failure.error, failure.stack);
			state = 'error';
		});
		return () => {
			active = false; checkpoints.dispose();
			if (Reflect.get(window, '__deferredScrollWarmupCheckpoints') === api)
				Reflect.deleteProperty(window, '__deferredScrollWarmupCheckpoints');
		};
	});
</script>

<h1>Deferred scroll warmup pixel proof</h1>
<p data-scroll-warmup-proof-state={state}>{state}</p>
<div bind:this={host}></div>
